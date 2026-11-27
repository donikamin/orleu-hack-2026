// Иконки приложения ученика: свои SVG, цветные, без внешних библиотек.
type P = { size?: number; className?: string };

export const Flame = ({ size = 22, className = '', on = true }: P & { on?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M12 2c1 4 6 6.5 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6.5 0 2 1 3.5 2.5 3.5C11 8 10 5 12 2z" fill={on ? '#ff6a00' : 'currentColor'} />
    <path d="M12 12c.6 2 3 3 3 5.2a3 3 0 0 1-6 0c0-1.4.8-2.3 1.6-3 .2 1 .8 1.6 1.4 1.6-.4-1.4-.6-2.6 0-3.8z" fill={on ? '#ffc400' : 'var(--s-card)'} />
  </svg>
);

export const Snow = ({ size = 22, className = '' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="5" fill="#2fb3f0" />
    <path d="M12 6v12M7 9l10 6M17 9 7 15M10 6.8 12 8.5l2-1.7M10 17.2l2-1.7 2 1.7" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" fill="none" />
  </svg>
);

export const Bolt = ({ size = 22, className = '' }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path d="M13.5 2 5 13.5h5.5L9.5 22 19 9.5h-5.8z" fill="#ffbf00" stroke="#d99a00" strokeWidth="1.2" strokeLinejoin="round" />
  </svg>
);

const S = (d: string) =>
  function I({ size = 24, className = '' }: P) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        <path d={d} />
      </svg>
    );
  };

export const IHome = S('M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z');
export const ICalc = S('M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7h8M8 11.5h.01M12 11.5h.01M16 11.5h.01M8 15.5h.01M12 15.5h.01M16 15.5v2.5M8 18.5h5');
export const IBook = S('M4 5h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v14h-6a2 2 0 0 0-2 1 2 2 0 0 0-2-1H4zM12 6v14');
export const ICam = S('M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z');
export const IUser = S('M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0');
export const IQr = S('M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18h2');
export const ITeacher = S('M3 5h18v11H3zM8 20h8M12 16v4');
export const IStar = S('M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z');
export const ICheck = S('M5 12.5l4.5 4.5L19 7.5');
export const ILesson = S('M4 6l8-3 8 3-8 3zM7 8v5c0 1.7 2.2 3 5 3s5-1.3 5-3V8M20 6v6');
export const IText = S('M5 4h10l4 4v12H5zM14 4v5h5M8 13h8M8 17h5');
export const IMic = S('M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3');
export const ISpeaker = S('M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12');
export const ITrophy = S('M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6v4H9z');
export const IPuzzle = S('M5 8h3a2 2 0 1 1 4 0h3v3a2 2 0 1 1 0 4v3h-3a2 2 0 1 0-4 0H5v-3a2 2 0 1 0 0-4z');
