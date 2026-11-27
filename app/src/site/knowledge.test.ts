import { describe, expect, it } from 'vitest';
import { isKazakh, kkForRussianVoice, knowledgeTopic, sayable } from './knowledge';

describe('знания и язык ИИ-ответчика', () => {
  it('вытаскивает тему вопроса «кто такой / что такое / расскажи про»', () => {
    expect(knowledgeTopic('Кто такой Дональд Трамп?')).toBe('Дональд Трамп');
    expect(knowledgeTopic('что такое фотосинтез')).toBe('фотосинтез');
    expect(knowledgeTopic('Расскажи про Аральское море')).toBe('Аральское море');
    expect(knowledgeTopic('Абай кім?')).toBe('Абай');
    expect(knowledgeTopic('как дела')).toBeNull();
    expect(knowledgeTopic('Кто такой Абай?')).toBe('Абай');
  });

  it('узнаёт казахский язык', () => {
    expect(isKazakh('Қалайсың?')).toBe(true);
    expect(isKazakh('Сәлем')).toBe(true);
    expect(isKazakh('сен кімсің')).toBe(true);
    expect(isKazakh('Как найти процент?')).toBe(false);
  });

  it('казахский текст для русского голоса: буква на букву, «сәлем» → «сэлем»', () => {
    expect(kkForRussianVoice('Сәлем, қалайсың?')).toBe('Сэлем, калайсын?');
    expect(kkForRussianVoice('көп өте күн')).toBe('кёп оте кюн');
    expect(kkForRussianVoice('Бір тіл').length).toBe('Бір тіл'.length);
  });

  it('название приложения звучит как «Оқу»', () => {
    expect(sayable('Я ИИ-ответчик Oqy.')).toBe('Я ИИ-ответчик Оқу.');
  });
});
