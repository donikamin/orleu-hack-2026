/// <reference lib="webworker" />
// Локальный ИИ в отдельном потоке: модель качается один раз (Cache API браузера), дальше отвечает без интернета.
// Весь тяжёлый код WebLLM живёт только здесь — главный поток и интерфейс не тормозят, пока модель думает.
import { CreateMLCEngine, deleteModelAllInfoInCache, hasModelInCache, type MLCEngine } from '@mlc-ai/web-llm';

type In =
  | { type: 'cached'; models: string[] }
  | { type: 'load'; model: string }
  | { type: 'chat'; id: number; messages: { role: 'system' | 'user' | 'assistant'; content: string }[]; maxTokens: number }
  | { type: 'stop' }
  | { type: 'delete'; model: string };

let engine: MLCEngine | null = null;
let loaded = '';
const post = (m: unknown) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = async (e: MessageEvent<In>) => {
  const m = e.data;
  try {
    if (m.type === 'cached') {
      const out: Record<string, boolean> = {};
      for (const id of m.models) out[id] = await hasModelInCache(id).catch(() => false);
      post({ type: 'cached', models: out });
    } else if (m.type === 'load') {
      if (engine && loaded === m.model) return post({ type: 'ready', model: m.model });
      await engine?.unload();
      engine = await CreateMLCEngine(m.model, {
        initProgressCallback: (p) => post({ type: 'progress', progress: p.progress, text: p.text }),
      });
      loaded = m.model;
      post({ type: 'ready', model: m.model });
    } else if (m.type === 'chat') {
      if (!engine) throw new Error('Локальный ИИ ещё не загружен');
      const started = performance.now();
      const stream = await engine.chat.completions.create({ messages: m.messages, stream: true, temperature: 0.2, frequency_penalty: 0.3, max_tokens: m.maxTokens });
      let text = '';
      let tokens = 0;
      for await (const chunk of stream) {
        const d = chunk.choices[0]?.delta?.content ?? '';
        if (d) {
          text += d;
          tokens++;
          post({ type: 'token', id: m.id, text });
        }
      }
      post({ type: 'done', id: m.id, text, tokensPerSec: tokens / ((performance.now() - started) / 1000) });
    } else if (m.type === 'stop') {
      engine?.interruptGenerate();
    } else if (m.type === 'delete') {
      if (loaded === m.model) {
        await engine?.unload();
        engine = null;
        loaded = '';
      }
      await deleteModelAllInfoInCache(m.model);
      post({ type: 'deleted', model: m.model });
    }
  } catch (err) {
    post({ type: 'error', id: 'id' in m ? m.id : undefined, message: (err as Error).message });
  }
};
