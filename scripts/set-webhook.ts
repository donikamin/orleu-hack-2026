// Один раз после деплоя: npm run bot:setup -- https://адрес.vercel.app
import fs from 'node:fs';
import { Bot } from 'grammy';

async function main() {
  if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_WEBHOOK_SECRET: secret } = process.env;
  const base = process.argv[2]?.replace(/\/$/, '');
  if (!token || !secret || !base?.startsWith('https://')) throw new Error('Нужны TELEGRAM_BOT_TOKEN и TELEGRAM_WEBHOOK_SECRET в .env.local и адрес https://… параметром');
  const bot = new Bot(token);
  await bot.api.setWebhook(`${base}/api/bot`, { secret_token: secret, allowed_updates: ['message', 'callback_query'] });
  await bot.api.setMyCommands([
    { command: 'task', description: 'Задание' },
    { command: 'report', description: 'Отчёт для родителя' },
    { command: 'stop', description: 'Отвязать чат' },
  ]);
  console.log('Webhook установлен:', (await bot.api.getWebhookInfo()).url);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
