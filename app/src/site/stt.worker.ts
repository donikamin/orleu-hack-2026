/// <reference lib="webworker" />
// Распознавание речи прямо на устройстве: Whisper base (OpenAI, MIT), ≈ 75 МБ, русский и казахский.
// Скачивается один раз, дальше работает без интернета. Отдельный поток — интерфейс не подвисает.
import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

type In = { type: 'run'; id: number; audio: Float32Array; lang: 'ru' | 'kk' } | { type: 'load' };

let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
const post = (m: unknown) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

function load() {
  if (!asr) {
    const files = new Map<string, { loaded: number; total: number }>();
    asr = pipeline('automatic-speech-recognition', 'onnx-community/whisper-base', {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status !== 'progress' || !p.file) return;
        files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
        let loaded = 0;
        let total = 0;
        files.forEach((f) => ((loaded += f.loaded), (total += f.total)));
        post({ type: 'progress', progress: total ? loaded / total : 0, mb: Math.round(total / 1048576) });
      },
    }) as Promise<AutomaticSpeechRecognitionPipeline>;
    asr.catch(() => (asr = null));
  }
  return asr;
}

self.onmessage = async (e: MessageEvent<In>) => {
  const m = e.data;
  try {
    const run = await load();
    if (m.type === 'load') return post({ type: 'ready' });
    const out = (await run(m.audio, { language: m.lang === 'kk' ? 'kazakh' : 'russian', task: 'transcribe', chunk_length_s: 30 })) as { text?: string };
    post({ type: 'text', id: m.id, text: (out.text ?? '').trim() });
  } catch (err) {
    post({ type: 'error', id: m.type === 'run' ? m.id : undefined, message: (err as Error).message });
  }
};
