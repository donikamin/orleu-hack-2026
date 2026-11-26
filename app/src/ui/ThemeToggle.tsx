import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';
const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<Theme, string> = { system: 'Тема: как в системе', light: 'Тема: светлая', dark: 'Тема: тёмная' };

function read(): Theme {
  try {
    const t = localStorage.getItem('oqy-theme');
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

/** Переключатель темы: система → светлая → тёмная. Выбор хранится на устройстве. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(read);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      if (theme === 'system') localStorage.removeItem('oqy-theme');
      else localStorage.setItem('oqy-theme', theme);
    } catch {
      /* приватный режим: просто не запоминаем */
    }
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme(NEXT[theme])}
      aria-label={`${LABEL[theme]}. Нажмите, чтобы сменить`}
      title={LABEL[theme]}
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-ink transition-colors hover:border-brand"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        {theme === 'dark' ? (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        ) : theme === 'light' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <>
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
          </>
        )}
      </svg>
    </button>
  );
}
