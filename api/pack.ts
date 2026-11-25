import { classCodeOf, handle, json } from '../server/http';
import { pack } from '../server/pack';
import { hasStore, store } from '../server/store';

// GET /api/pack?v=1[&class=8K3TQ] — база + (по желанию) задания класса, сделанные из фото
export const GET = handle(async (req) => {
  const code = new URL(req.url).searchParams.get('class');
  if (!code) return json(pack(), 200, { 'cache-control': 'public, max-age=300, s-maxage=3600' });
  const extra = hasStore() ? await store().classTasks(classCodeOf(code)) : [];
  return json([...pack(), ...extra]);
});
