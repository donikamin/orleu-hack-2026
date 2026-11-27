import { describe, expect, it } from 'vitest';
import { offlineAnswer, offlineKnows } from './offlineAnswer';

describe('офлайн-ответы ИИ-ответчика', () => {
  it('поддерживает разговор: привет, как дела, кто ты, спасибо — по-русски и по-казахски', () => {
    expect(offlineAnswer('Привет')).toMatch(/Привет|Сәлем|утро|вечер/);
    expect(offlineAnswer('как дела?')).toMatch(/отлично|Хорошо|Жақсы/);
    expect(offlineAnswer('Кто ты?')).toMatch(/Oqy/);
    expect(offlineKnows('Кто такой Дональд Трамп?')).toBe(false); // это вопрос к Википедии, а не «кто ты»
    expect(offlineAnswer('спасибо')).toMatch(/Пожалуйста|помочь|Оқасы/);
    expect(offlineAnswer('рахмет')).toMatch(/Оқасы|көмектесуге/);
    expect(offlineAnswer('Қалайсың?')).toMatch(/Жақсы|Бәрі керемет/);
  });

  it('одинаковый вопрос подряд — разные варианты ответа', () => {
    const a = offlineAnswer('как дела');
    const b = offlineAnswer('как дела');
    expect(a).not.toBe(b);
  });

  it('тема учёбы важнее приветствия; проценты объясняет без готового ответа', () => {
    const r = offlineAnswer('Привет, как найти 15% от 24 000?');
    expect(r).toMatch(/1%/);
    expect(r).not.toMatch(/3\s?600/); // итог не называет
  });

  it('считает простые выражения и не выполняет посторонний код', () => {
    expect(offlineAnswer('сколько будет 25 * 4')).toMatch(/= 100/);
    expect(offlineAnswer('(12,5 + 7,5) / 4')).toMatch(/= 5/);
    expect(offlineAnswer('alert(1)')).not.toMatch(/=/);
  });

  it('на казахском отвечает по-казахски', () => {
    expect(offlineAnswer('Сәлем!')).toMatch(/Сәлем|Сәлеметсің/);
    expect(offlineAnswer('Сен кімсің?')).toMatch(/ИИ-жауапкер/);
    expect(offlineAnswer('Рахмет')).toMatch(/Оқасы|көмектесуге/);
  });

  it('незнакомый вопрос — подсказывает, что спросить, а не одну и ту же фразу', () => {
    const seen = new Set(Array.from({ length: 6 }, () => offlineAnswer('какая столица Франции')));
    expect(seen.size).toBeGreaterThan(1);
  });
});
