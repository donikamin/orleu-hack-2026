import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// Офлайн-версия обновляется сама: проверяем новую версию при открытии, раз в минуту и при возврате на вкладку.
// Нашлась — новая версия ставится и страница один раз перезагружается (registerType: 'autoUpdate').
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => {
      if (navigator.onLine && !reg.installing) void reg.update().catch(() => {});
    };
    window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    window.addEventListener('online', check);
  },
});

// Android: запоминаем предложение установки, кнопка «Установить на телефон» в кабинете покажет его
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  (window as unknown as { __oqyInstall: Event }).__oqyInstall = e;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
