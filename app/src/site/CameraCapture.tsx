// Живая камера прямо в приложении: навёл на задачу — «Снять». Работает и на телефоне (задняя камера), и на ноутбуке.
// Нет камеры или доступа — открывается обычный выбор фото из галереи/файлов.
import { useEffect, useRef, useState } from 'react';

export function CameraCapture({ onShot, onClose, onFallback }: { onShot: (file: File) => void; onClose: () => void; onFallback: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<'starting' | 'live' | 'error'>('starting');
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');

  useEffect(() => {
    let dead = false;
    (async () => {
      setState('starting');
      try {
        stream.current?.getTracks().forEach((t) => t.stop());
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
        if (dead) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        setState('live');
      } catch {
        if (!dead) setState('error');
      }
    })();
    return () => {
      dead = true;
    };
  }, [facing]);

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  function shoot() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = Object.assign(document.createElement('canvas'), { width: v.videoWidth, height: v.videoHeight });
    c.getContext('2d')!.drawImage(v, 0, 0);
    c.toBlob((b) => {
      if (!b) return;
      stream.current?.getTracks().forEach((t) => t.stop());
      onShot(new File([b], 'zadacha.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  }

  return (
    <div className="cam" role="dialog" aria-modal="true" aria-label="Камера: сфотографируй задачу">
      <div className="cam__frame">
        <video ref={video} playsInline muted className="cam__video" />
        <span className="cam__guide" aria-hidden="true" />
        {state === 'starting' && <p className="cam__msg">Включаю камеру…</p>}
        {state === 'error' && (
          <div className="cam__msg">
            <p>Камера недоступна: нет доступа или её нет на устройстве.</p>
            <button type="button" className="site-btn site-btn--solid" onClick={onFallback}>Выбрать фото из галереи</button>
          </div>
        )}
        <p className="cam__hint">Задача целиком в рамке, без бликов</p>
      </div>
      <div className="cam__bar">
        <button type="button" className="site-btn site-btn--ghost" onClick={onClose}>Отмена</button>
        <button type="button" className="cam__shoot" onClick={shoot} disabled={state !== 'live'} aria-label="Снять фото">
          <span />
        </button>
        <button type="button" className="site-btn site-btn--ghost" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}>Сменить камеру</button>
      </div>
      <button type="button" className="link-btn cam__gallery" onClick={onFallback}>или выбрать фото из галереи</button>
    </div>
  );
}
