/**
 * 물리 키 위치(KeyboardEvent.code)를 화면에 보여 줄 글자로 바꾼다.
 * event.key 대신 code를 쓰는 이유: 한/영 상태·IME·기기 언어 설정과 무관하게 항상 같은 값이 들어온다.
 */

export type DisplayMode = 'number-hangul' | 'number-latin' | 'latin-hangul';
export type LetterCase = 'upper' | 'lower';
export type GlyphKind = 'digit' | 'latin' | 'jamo';

export interface MapOptions {
  readonly mode: DisplayMode;
  readonly letterCase: LetterCase;
}

export interface KeyPress {
  readonly code: string;
  readonly shiftKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}

export interface Glyph {
  readonly kind: GlyphKind;
  readonly char: string;
}

export type KeyOutput =
  | { readonly type: 'glyphs'; readonly glyphs: readonly Glyph[] }
  | { readonly type: 'decor' }
  | { readonly type: 'ignore' };

const DECOR: KeyOutput = Object.freeze({ type: 'decor' });
const IGNORE: KeyOutput = Object.freeze({ type: 'ignore' });

const DIGIT_CODE = /^(?:Digit|Numpad)([0-9])$/;
const LETTER_CODE = /^Key([A-Z])$/;

/** 두벌식 자판: 영문 키 → 한글 자모 (자판 모양대로 3줄 배치) */
// prettier-ignore
const DUBEOLSIK: Readonly<Record<string, string>> = {
  Q: 'ㅂ', W: 'ㅈ', E: 'ㄷ', R: 'ㄱ', T: 'ㅅ', Y: 'ㅛ', U: 'ㅕ', I: 'ㅑ', O: 'ㅐ', P: 'ㅔ',
  A: 'ㅁ', S: 'ㄴ', D: 'ㅇ', F: 'ㄹ', G: 'ㅎ', H: 'ㅗ', J: 'ㅓ', K: 'ㅏ', L: 'ㅣ',
  Z: 'ㅋ', X: 'ㅌ', C: 'ㅊ', V: 'ㅍ', B: 'ㅠ', N: 'ㅜ', M: 'ㅡ',
};

/** 두벌식 Shift 자모 (쌍자음, ㅒ, ㅖ) */
// prettier-ignore
const DUBEOLSIK_SHIFT: Readonly<Record<string, string>> = {
  Q: 'ㅃ', W: 'ㅉ', E: 'ㄸ', R: 'ㄲ', T: 'ㅆ', O: 'ㅒ', P: 'ㅖ',
};

/** 단독으로 눌렸을 때 아무것도 보여 주지 않는 키 */
const MODIFIER_CODES: ReadonlySet<string> = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'Fn',
  'FnLock',
  'Lang1',
  'Lang2',
  'Lang3',
  'Lang4',
  'Lang5',
]);

export function mapKey(press: KeyPress, options: MapOptions): KeyOutput {
  // Ctrl/Alt/Meta 조합은 부모용 단축키(예: Ctrl+Alt+P)이므로 화면에 반응하지 않는다.
  if (MODIFIER_CODES.has(press.code) || press.ctrlKey || press.altKey || press.metaKey) {
    return IGNORE;
  }

  const digit = DIGIT_CODE.exec(press.code)?.[1];
  if (digit !== undefined) {
    return { type: 'glyphs', glyphs: [{ kind: 'digit', char: digit }] };
  }

  const letter = LETTER_CODE.exec(press.code)?.[1];
  if (letter !== undefined) {
    return { type: 'glyphs', glyphs: letterGlyphs(letter, press.shiftKey, options) };
  }

  return DECOR;
}

function letterGlyphs(letter: string, shiftKey: boolean, options: MapOptions): readonly Glyph[] {
  const latin: Glyph = {
    kind: 'latin',
    char: options.letterCase === 'upper' ? letter : letter.toLowerCase(),
  };
  const jamoChar = (shiftKey ? DUBEOLSIK_SHIFT[letter] : undefined) ?? DUBEOLSIK[letter] ?? '';
  const jamo: Glyph = { kind: 'jamo', char: jamoChar };

  switch (options.mode) {
    case 'number-hangul':
      return [jamo];
    case 'number-latin':
      return [latin];
    case 'latin-hangul':
      return [latin, jamo];
  }
}
