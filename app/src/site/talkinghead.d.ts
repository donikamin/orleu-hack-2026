// Типы для TalkingHead (библиотека на JS без своих типов): только то, что использует ИИ-ответчик.
declare module '@met4citizen/talkinghead' {
  export interface SpeakAudio {
    audio: AudioBuffer;
    words: string[];
    wtimes: number[];
    wdurations: number[];
  }
  export class TalkingHead {
    constructor(node: HTMLElement, opt?: Record<string, unknown>);
    audioCtx: AudioContext;
    lipsync: Record<string, unknown>;
    isSpeaking: boolean;
    showAvatar(avatar: Record<string, unknown>, onprogress?: (e: ProgressEvent) => void): Promise<void>;
    speakAudio(r: SpeakAudio, opt?: { lipsyncLang?: string }): void;
    speakMarker(fn: () => void): void;
    stopSpeaking(): void;
    setMood(mood: string): void;
    lookAtCamera(ms: number): void;
    speakWithHands(delay?: number, prob?: number): void;
    start(): void;
    stop(): void;
  }
}
declare module '@met4citizen/talkinghead/modules/lipsync-en.mjs' {
  export class LipsyncEn {}
}
