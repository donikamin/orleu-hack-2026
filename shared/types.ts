// Контракты из PLAN.md, раздел 6. Меняем только договорившись втроём (A, B, C).

export type Skill = 'locate' | 'understand' | 'evaluate'; // найти / понять / оценить
export type Format = 'classic' | 'investigation' | 'fake' | 'family' | 'ask';
export type Lang = 'ru' | 'kk';

export interface Task {
  id: string; // "c-loc-01", "inv-03", "photo-<uuid>"
  format: Format;
  skill: Skill;
  difficulty: 1 | 2 | 3;
  lang: Lang;
  title: string;
  docs: { title: string; body: string }[]; // 1 текст или несколько документов
  question: string;
  answer:
    | { type: 'choice'; options: string[]; correct: number }
    | { type: 'multi'; options: string[]; correct: number[] }
    | { type: 'spans'; sentences: string[]; correct: number[] } // «Найди, где врут»
    | { type: 'free'; rubric: string[] }; // онлайн-проверка ИИ
  hints: [string, string, string]; // лестница: общая → конкретная, без ответа
  explanation: string; // показываем ПОСЛЕ ответа
  source?: 'pack' | 'photo' | 'ai';
}

export interface Attempt {
  taskId: string;
  score: 0 | 0.5 | 1;
  hintsUsed: 0 | 1 | 2 | 3;
  confidence?: 1 | 2 | 3; // 1 угадываю, 3 уверен
  answer?: string; // только для free/ask, на сервер
  ts: number; // unix, секунды
}

export interface Student {
  classCode: string;
  number: number;
} // без имён

export interface SkillState {
  skill: Skill;
  rating: number;
  attempts: number;
}

export const SKILLS: Skill[] = ['locate', 'understand', 'evaluate'];

export const SKILL_LABEL: Record<Skill, string> = {
  locate: 'Найти',
  understand: 'Понять',
  evaluate: 'Оценить',
};

export const SKILL_HINT: Record<Skill, string> = {
  locate: 'Находит нужную информацию в тексте',
  understand: 'Понимает смысл и делает выводы, связывает факты',
  evaluate: 'Оценивает достоверность, замечает манипуляции',
};
