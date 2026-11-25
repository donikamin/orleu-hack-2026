import { classCodeOf, handle, json, limit } from '../../server/http';
import { requireTeacher, skillsFor, store } from '../../server/store';

export const GET = handle(async (req) => {
  limit(req, 'class-get', 30);
  const code = classCodeOf(decodeURIComponent(new URL(req.url).pathname.split('/').filter(Boolean).pop() ?? ''));
  const cls = await requireTeacher(req, code);
  const [numbers, attempts] = await Promise.all([store().listStudents(code), store().attemptsOf(code)]);
  const skills = await skillsFor(attempts);
  return json({ classCode: code, name: cls.name, students: numbers.map((number) => ({ number, skills: skills(number) })), attempts });
});
