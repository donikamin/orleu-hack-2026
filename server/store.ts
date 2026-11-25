// Хранилище: Supabase, а при локальной разработке без ключей — память процесса.
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { computeSkills } from '../shared/elo';
import type { Attempt, SkillState, Student, Task } from '../shared/types';
import { HttpError } from './http';
import { pack } from './pack';

export type Via = 'online' | 'qr' | 'bot';
export type StoredAttempt = Attempt & { number: number; via: Via };
export type Role = 'student' | 'parent';
export interface ClassInfo {
  code: string;
  name: string;
  keyHash: string | null;
}

export interface Store {
  /** false — код уже занят */
  addClass(code: string, name: string, keyHash: string): Promise<boolean>;
  getClass(code: string): Promise<ClassInfo | null>;
  ensureStudent(s: Student): Promise<void>;
  listStudents(code: string): Promise<number[]>;
  /** Возвращает, сколько новых. */
  addAttempts(s: Student, attempts: Attempt[], via: Via): Promise<number>;
  attemptsOf(code: string, number?: number): Promise<StoredAttempt[]>;
  saveSkills(s: Student, skills: SkillState[]): Promise<void>;
  getTasks(ids: string[]): Promise<Task[]>;
  classTasks(code: string): Promise<Task[]>;
  /** Чужие задания не перезаписываются. */
  saveTasks(tasks: Task[], classCode: string | null): Promise<void>;
  chatOf(s: Student, role: Role): Promise<number | null>;
  setChat(s: Student, role: Role, chatId: number | null): Promise<void>;
  studentsByChat(chatId: number, role: Role): Promise<Student[]>;
  linkedChats(role: Role): Promise<(Student & { chatId: number })[]>;
}

export class MemoryStore implements Store {
  private classes = new Map<string, ClassInfo>([['DEMO', { code: 'DEMO', name: 'Демо-класс', keyHash: null }]]);
  private students = new Map<string, Student & { student: number | null; parent: number | null }>();
  private attempts = new Map<string, { classCode: string; a: StoredAttempt }>();
  private tasks = new Map<string, { task: Task; classCode: string | null }>();
  private row = (s: Student) => this.students.get(`${s.classCode}|${s.number}`);

  async addClass(code: string, name: string, keyHash: string) {
    if (this.classes.has(code)) return false;
    this.classes.set(code, { code, name, keyHash });
    return true;
  }
  async getClass(code: string) {
    return this.classes.get(code) ?? null;
  }
  async ensureStudent(s: Student) {
    if (!this.row(s)) this.students.set(`${s.classCode}|${s.number}`, { ...s, student: null, parent: null });
  }
  async listStudents(code: string) {
    return [...this.students.values()].filter((s) => s.classCode === code).map((s) => s.number).sort((a, b) => a - b);
  }
  async addAttempts(s: Student, list: Attempt[], via: Via) {
    let n = 0;
    for (const a of list) {
      const k = `${s.classCode}|${s.number}|${a.taskId}|${a.ts}`;
      if (this.attempts.has(k)) continue;
      this.attempts.set(k, { classCode: s.classCode, a: { ...a, number: s.number, via } });
      n++;
    }
    return n;
  }
  async attemptsOf(code: string, number?: number) {
    return [...this.attempts.values()].filter((x) => x.classCode === code && (number === undefined || x.a.number === number)).map((x) => x.a);
  }
  async saveSkills() {}
  async getTasks(ids: string[]) {
    return ids.flatMap((id) => this.tasks.get(id)?.task ?? []);
  }
  async classTasks(code: string) {
    return [...this.tasks.values()].filter((t) => t.classCode === code).map((t) => t.task);
  }
  async saveTasks(tasks: Task[], classCode: string | null) {
    for (const t of tasks) {
      const owner = this.tasks.get(t.id)?.classCode;
      if (owner && owner !== classCode) throw new HttpError(403, 'Задание принадлежит другому классу');
    }
    for (const task of tasks) this.tasks.set(task.id, { task, classCode });
  }
  async chatOf(s: Student, role: Role) {
    return this.row(s)?.[role] ?? null;
  }
  async setChat(s: Student, role: Role, chatId: number | null) {
    const r = this.row(s);
    if (r) r[role] = chatId;
  }
  async studentsByChat(chatId: number, role: Role) {
    return [...this.students.values()].filter((s) => s[role] === chatId).map(({ classCode, number }) => ({ classCode, number }));
  }
  async linkedChats(role: Role) {
    return [...this.students.values()].flatMap((s) => (s[role] ? [{ classCode: s.classCode, number: s.number, chatId: s[role]! }] : []));
  }
}

const PAGE = 1000; // Supabase отдаёт не больше 1000 строк за запрос
type DbError = { message: string; code?: string } | null;

export class SupabaseStore implements Store {
  private db: SupabaseClient;
  constructor(url: string, key: string) {
    this.db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  private ok<T>(r: { data: unknown; error: DbError }): T {
    if (r.error) throw new Error(`Supabase: ${r.error.message}`);
    return r.data as T;
  }
  private async all<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: DbError }>): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
      const rows = this.ok<T[]>(await page(from, from + PAGE - 1));
      out.push(...rows);
      if (rows.length < PAGE) return out;
    }
  }
  private col = (role: Role) => (role === 'student' ? 'tg_chat_id' : 'parent_chat_id');

  async addClass(code: string, name: string, keyHash: string) {
    const r = await this.db.from('classes').insert({ code, name, teacher_key_hash: keyHash });
    if (r.error?.code === '23505') return false;
    this.ok(r);
    return true;
  }
  async getClass(code: string) {
    const r = this.ok<{ code: string; name: string; teacher_key_hash: string | null } | null>(
      await this.db.from('classes').select('code,name,teacher_key_hash').eq('code', code).maybeSingle(),
    );
    return r ? { code: r.code, name: r.name, keyHash: r.teacher_key_hash } : null;
  }
  async ensureStudent(s: Student) {
    this.ok(await this.db.from('students').upsert({ class_code: s.classCode, number: s.number }, { onConflict: 'class_code,number', ignoreDuplicates: true }));
  }
  async listStudents(code: string) {
    return this.ok<{ number: number }[]>(await this.db.from('students').select('number').eq('class_code', code).order('number')).map((r) => r.number);
  }
  async addAttempts(s: Student, list: Attempt[], via: Via) {
    if (!list.length) return 0;
    const rows = list.map((a) => ({
      class_code: s.classCode,
      number: s.number,
      task_id: a.taskId,
      score: a.score,
      hints_used: a.hintsUsed,
      confidence: a.confidence ?? null,
      answer: a.answer ?? null,
      ts: a.ts,
      via,
    }));
    const added = await this.db.from('attempts').upsert(rows, { onConflict: 'class_code,number,task_id,ts', ignoreDuplicates: true }).select('id');
    return this.ok<unknown[]>(added).length;
  }
  async attemptsOf(code: string, number?: number) {
    type Row = { number: number; task_id: string; score: number; hints_used: number; confidence: number | null; answer: string | null; ts: number; via: Via };
    const rows = await this.all<Row>((from, to) => {
      let q = this.db.from('attempts').select('number,task_id,score,hints_used,confidence,answer,ts,via').eq('class_code', code);
      if (number !== undefined) q = q.eq('number', number);
      return q.order('id').range(from, to);
    });
    return rows.map(
      (r): StoredAttempt => ({
        number: r.number,
        via: r.via,
        taskId: r.task_id,
        score: Number(r.score) as Attempt['score'],
        hintsUsed: r.hints_used as Attempt['hintsUsed'],
        ...(r.confidence ? { confidence: r.confidence as 1 | 2 | 3 } : {}),
        ...(r.answer ? { answer: r.answer } : {}),
        ts: Number(r.ts),
      }),
    );
  }
  async saveSkills(s: Student, skills: SkillState[]) {
    this.ok(await this.db.from('skill_state').upsert(skills.map((k) => ({ class_code: s.classCode, number: s.number, ...k }))));
  }
  async getTasks(ids: string[]) {
    if (!ids.length) return [];
    return this.ok<{ payload: Task }[]>(await this.db.from('tasks').select('payload').in('id', ids)).map((r) => r.payload);
  }
  async classTasks(code: string) {
    return this.ok<{ payload: Task }[]>(await this.db.from('tasks').select('payload').eq('class_code', code).order('id').limit(PAGE)).map((r) => r.payload);
  }
  async saveTasks(tasks: Task[], classCode: string | null) {
    const owners = this.ok<{ class_code: string | null }[]>(await this.db.from('tasks').select('class_code').in('id', tasks.map((t) => t.id)));
    if (owners.some((r) => r.class_code && r.class_code !== classCode)) throw new HttpError(403, 'Задание принадлежит другому классу');
    const rows = tasks.map((t) => ({ id: t.id, format: t.format, skill: t.skill, difficulty: t.difficulty, lang: t.lang, payload: t, source: t.source ?? 'ai', class_code: classCode }));
    this.ok(await this.db.from('tasks').upsert(rows));
  }
  async chatOf(s: Student, role: Role) {
    const r = this.ok<{ tg_chat_id: number | null; parent_chat_id: number | null } | null>(
      await this.db.from('students').select('tg_chat_id,parent_chat_id').eq('class_code', s.classCode).eq('number', s.number).maybeSingle(),
    );
    const v = role === 'student' ? r?.tg_chat_id : r?.parent_chat_id;
    return v ? Number(v) : null;
  }
  async setChat(s: Student, role: Role, chatId: number | null) {
    this.ok(await this.db.from('students').update({ [this.col(role)]: chatId }).eq('class_code', s.classCode).eq('number', s.number));
  }
  async studentsByChat(chatId: number, role: Role) {
    const rows = this.ok<{ class_code: string; number: number }[]>(await this.db.from('students').select('class_code,number').eq(this.col(role), chatId));
    return rows.map((r) => ({ classCode: r.class_code, number: r.number }));
  }
  async linkedChats(role: Role) {
    type Row = { class_code: string; number: number; tg_chat_id: number | null; parent_chat_id: number | null };
    const rows = await this.all<Row>((from, to) =>
      this.db.from('students').select('class_code,number,tg_chat_id,parent_chat_id').not(this.col(role), 'is', null).order('class_code').order('number').range(from, to),
    );
    return rows.map((r) => ({ classCode: r.class_code, number: r.number, chatId: Number(role === 'student' ? r.tg_chat_id : r.parent_chat_id) }));
  }
}

let current: Store | undefined;
export const setStore = (s: Store | undefined) => void (current = s); // для тестов
export const hasStore = () => !!current || !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) || !process.env.VERCEL;

export function store(): Store {
  if (current) return current;
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (url && key) return (current = new SupabaseStore(url, key));
  // На Vercel память не общая между вызовами: честная ошибка лучше потерянных данных.
  if (process.env.VERCEL) throw new HttpError(503, 'База данных ещё не подключена');
  return (current = new MemoryStore());
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const token = (n: number) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
export const hashKey = (k: string) => createHash('sha256').update(k).digest('hex');
export const sameSecret = (a: string, b: string) => timingSafeEqual(Buffer.from(hashKey(a)), Buffer.from(hashKey(b)));

export async function requireTeacher(req: Request, code: string): Promise<ClassInfo> {
  const cls = await store().getClass(code);
  const given = Buffer.from(hashKey(req.headers.get('x-teacher-key') ?? ''));
  // Один ответ и для чужого ключа, и для несуществующего класса: коды нельзя перебирать.
  if (!cls?.keyHash || !timingSafeEqual(given, Buffer.from(cls.keyHash))) throw new HttpError(403, 'Неверный код класса или ключ учителя');
  return cls;
}

export async function findTask(id: string): Promise<Task> {
  const t = pack().find((x) => x.id === id) ?? (hasStore() ? (await store().getTasks([id]))[0] : undefined);
  if (!t) throw new HttpError(404, 'Задание не найдено');
  return t;
}

export async function skillsFor(list: StoredAttempt[]): Promise<(number: number) => SkillState[]> {
  const known = new Map(pack().map((t) => [t.id, t]));
  const missing = [...new Set(list.map((a) => a.taskId))].filter((id) => !known.has(id));
  for (let i = 0; i < missing.length; i += 100) for (const t of await store().getTasks(missing.slice(i, i + 100))) known.set(t.id, t);
  return (number) => computeSkills(list.filter((a) => a.number === number), (id) => known.get(id));
}

/** Сохранить попытки и пересчитать навыки по всей истории: порядок доставки не важен. */
export async function record(s: Student, attempts: Attempt[], via: Via) {
  if (!(await store().getClass(s.classCode))) throw new HttpError(404, 'Класс не найден на сервере. Отдай результаты учителю через QR-код.');
  await store().ensureStudent(s);
  const added = await store().addAttempts(s, attempts, via);
  const skills = (await skillsFor(await store().attemptsOf(s.classCode, s.number)))(s.number);
  await store().saveSkills(s, skills);
  return { added, skills };
}
