import { describe, expect, it } from 'vitest';
import { mapKey, type Glyph } from '../input/keymap';
import { allSpeechTexts, getGlyphInfo } from './glyphs';

const LETTER_CODES = Array.from({ length: 26 }, (_, k) => `Key${String.fromCharCode(65 + k)}`);
const DIGIT_CODES = Array.from({ length: 10 }, (_, k) => `Digit${k}`);

function glyphsFor(code: string, shiftKey: boolean): readonly Glyph[] {
  const result = mapKey(
    { code, shiftKey, ctrlKey: false, altKey: false, metaKey: false },
    { mode: 'latin-hangul', letterCase: 'upper' },
  );
  return result.type === 'glyphs' ? result.glyphs : [];
}

function allReachableGlyphs(): readonly Glyph[] {
  const fromLetters = LETTER_CODES.flatMap((code) => [
    ...glyphsFor(code, false),
    ...glyphsFor(code, true),
  ]);
  const fromDigits = DIGIT_CODES.flatMap((code) => glyphsFor(code, false));
  return [...fromLetters, ...fromDigits];
}

describe('getGlyphInfo', () => {
  it('has speech and an emoji for every glyph the keyboard can produce', () => {
    const missing = allReachableGlyphs().filter((glyph) => {
      const info = getGlyphInfo(glyph);
      return info.speech.trim() === '' || info.emoji.trim() === '';
    });

    expect(missing).toEqual([]);
  });

  it.each([
    [{ kind: 'digit', char: '0' }, '영'],
    [{ kind: 'digit', char: '1' }, '일'],
    [{ kind: 'digit', char: '3' }, '삼'],
    [{ kind: 'digit', char: '9' }, '구'],
    [{ kind: 'latin', char: 'A' }, '에이'],
    [{ kind: 'latin', char: 'W' }, '더블유'],
    [{ kind: 'jamo', char: 'ㄱ' }, '기역'],
    [{ kind: 'jamo', char: 'ㄲ' }, '쌍기역'],
    [{ kind: 'jamo', char: 'ㅏ' }, '아'],
    [{ kind: 'jamo', char: 'ㅢ' }, ''],
  ] as const)('reads %o as %j', (glyph, speech) => {
    expect(getGlyphInfo(glyph).speech).toBe(speech);
  });

  it('uses the same info for lowercase and uppercase latin letters', () => {
    expect(getGlyphInfo({ kind: 'latin', char: 'b' })).toEqual(
      getGlyphInfo({ kind: 'latin', char: 'B' }),
    );
  });

  it('shows as many chicks as the digit value', () => {
    expect(getGlyphInfo({ kind: 'digit', char: '3' }).emoji).toBe('🐥🐥🐥');
    expect(getGlyphInfo({ kind: 'digit', char: '1' }).emoji).toBe('🐥');
  });

  it('shows an egg for zero', () => {
    expect(getGlyphInfo({ kind: 'digit', char: '0' }).emoji).toBe('🥚');
  });

  it.each([
    { kind: 'latin', char: '?' },
    { kind: 'digit', char: 'x' },
    { kind: 'digit', char: '12' },
  ] as const)('returns empty info for unknown glyph %o', (glyph) => {
    expect(getGlyphInfo(glyph)).toEqual({ speech: '', emoji: '' });
  });
});

describe('allSpeechTexts', () => {
  it('lists every spoken name once (the MeloTTS clips to generate)', () => {
    const texts = allSpeechTexts();

    expect(new Set(texts).size).toBe(texts.length);
    expect(texts).toHaveLength(64);
    expect(texts).toEqual(
      expect.arrayContaining(['영', '구', '에이', '제트', '기역', '히읗', '아', '이']),
    );
  });

  it('covers the speech of every glyph the keyboard can produce', () => {
    const texts = new Set(allSpeechTexts());

    const missing = allReachableGlyphs()
      .map((glyph) => getGlyphInfo(glyph).speech)
      .filter((speech) => !texts.has(speech));

    expect(missing).toEqual([]);
  });
});
