// Аналитика продукта (PostHog): какие задания решают, где застревают, пользуются ли ИИ-ответчиком.
// Анонимно: без имён и номеров учеников, IP обезличиваются в проекте, без записи сессий и автосбора кликов.
// Ключ берётся из VITE_POSTHOG_KEY (на Vercel — Environment Variables). Нет ключа или нет сети — ничего не грузится,
// библиотека подтягивается отдельным куском уже после открытия приложения, на 2G первый экран от неё не зависит.
type PH = { capture: (event: string, props?: Record<string, unknown>) => void };

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.i.posthog.com';

let client: PH | null = null;
let loading: Promise<PH | null> | null = null;
const queue: [string, Record<string, unknown> | undefined][] = [];

function load(): Promise<PH | null> {
  if (!KEY || typeof window === 'undefined') return Promise.resolve(null);
  if (!loading) {
    loading = import('posthog-js')
      .then(({ default: posthog }) => {
        posthog.init(KEY, {
          api_host: HOST,
          person_profiles: 'identified_only', // анонимные события, без профилей людей
          autocapture: false,
          capture_pageview: false,
          disable_session_recording: true,
          disable_surveys: true, // не качаем лишние модули — экономим трафик
          advanced_disable_feature_flags: true,
          persistence: 'localStorage',
        });
        client = posthog;
        queue.splice(0).forEach(([e, p]) => posthog.capture(e, p));
        return posthog as PH;
      })
      .catch(() => null);
  }
  return loading;
}

/** Событие продукта. Без сети или ключа просто ничего не происходит. */
export function track(event: string, props?: Record<string, unknown>) {
  if (!KEY) return;
  if (client) client.capture(event, props);
  else {
    if (queue.length < 50) queue.push([event, props]);
    if (navigator.onLine) void load();
  }
}

/** Просмотр экрана: вызывается при смене адреса. */
export function trackScreen(path: string) {
  track('$pageview', { $current_url: `${location.origin}${path}`, screen: path.split('/')[1] || 'home' });
}
