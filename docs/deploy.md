# Деплой на Vercel (делает капитан один раз, ~10 минут)

> Нет желания подключать свой Vercel? Другой участник может развернуть сайт из своего аккаунта: [docs/deploy-iskender.md](deploy-iskender.md).

1. Зайти на https://vercel.com и войти через GitHub (аккаунт `donikamin`).
2. **Add New → Project → Import** репозиторий `orleu-hack-2026`.
3. Настройки менять не нужно: всё уже в `vercel.json` (сборка `app/`, папка `app/dist`, функции из `/api`).
4. **Deploy.** Через 1–2 минуты будет ссылка `https://orleu-hack-2026-….vercel.app`. Её можно переименовать в Settings → Domains (например `oqy.vercel.app`, если свободно).
5. Каждый Pull Request получает свою preview-ссылку, `main` — основную.

## Переменные окружения (добавляет Искендер, часть B)

Settings → Environment Variables:

| Имя | Где взять |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API |
| `TELEGRAM_BOT_TOKEN` | @BotFather |

Ключи **никогда** не коммитим и не используем во фронтенде.

## Проверка после деплоя

- Открыть ссылку с телефона → «Я учитель» → «Открыть демо-класс».
- Включить режим самолёта, обновить страницу: панель должна открыться (PWA-кэш).
- `/demo/qr` на одном устройстве, «Сканировать QR» на другом: результаты должны появиться.
