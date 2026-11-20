import { describe, expect, it } from 'vitest';
import { mapKey, type DisplayMode, type KeyPress, type MapOptions } from './keymap';

const ALL_MODES: readonly DisplayMode[] = ['number-hangul', 'number-latin', 'latin-hangul'];

function press(code: string, extra: Partial<KeyPress> = {}): KeyPress {
  return { code, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...extra };
}

function opts(mode: DisplayMode, letterCase: MapOptions['letterCase'] = 'upper'): MapOptions {
  return { mode, letterCase };
}

describe('mapKey', () => {
  describe('digits', () => {
    it.each([
      ['Digit0', '0'],
      ['Digit3', '3'],
      ['Digit9', '9'],
      ['Numpad0', '0'],
      ['Numpad7', '7'],
    ])('maps %s to digit %s in every mode', (code, char) => {
      for (const mode of ALL_MODES) {
        expect(mapKey(press(code), opts(mode))).toEqual({
          type: 'glyphs',
          glyphs: [{ kind: 'digit', char }],
        });
      }
    });
  });

  describe('letters', () => {
    it('shows the dubeolsik jamo in number-hangul mode', () => {
      expect(mapKey(press('KeyR'), opts('number-hangul'))).toEqual({
        type: 'glyphs',
        glyphs: [{ kind: 'jamo', char: 'ㄱ' }],
      });
    });

    it('shows the uppercase latin letter in number-latin mode', () => {
      expect(mapKey(press('KeyR'), opts('number-latin'))).toEqual({
        type: 'glyphs',
        glyphs: [{ kind: 'latin', char: 'R' }],
      });
    });

    it('shows the lowercase latin letter when letterCase is lower', () => {
      expect(mapKey(press('KeyR'), opts('number-latin', 'lower'))).toEqual({
        type: 'glyphs',
        glyphs: [{ kind: 'latin', char: 'r' }],
      });
    });

    it('shows latin and jamo together in latin-hangul mode', () => {
      expect(mapKey(press('KeyR'), opts('latin-hangul'))).toEqual({
        type: 'glyphs',
        glyphs: [
          { kind: 'latin', char: 'R' },
          { kind: 'jamo', char: 'ㄱ' },
        ],
      });
    });

    it.each([
      ['KeyQ', 'ㅂ'],
      ['KeyW', 'ㅈ'],
      ['KeyE', 'ㄷ'],
      ['KeyR', 'ㄱ'],
      ['KeyT', 'ㅅ'],
      ['KeyY', 'ㅛ'],
      ['KeyU', 'ㅕ'],
      ['KeyI', 'ㅑ'],
      ['KeyO', 'ㅐ'],
      ['KeyP', 'ㅔ'],
      ['KeyA', 'ㅁ'],
      ['KeyS', 'ㄴ'],
      ['KeyD', 'ㅇ'],
      ['KeyF', 'ㄹ'],
      ['KeyG', 'ㅎ'],
      ['KeyH', 'ㅗ'],
      ['KeyJ', 'ㅓ'],
      ['KeyK', 'ㅏ'],
      ['KeyL', 'ㅣ'],
      ['KeyZ', 'ㅋ'],
      ['KeyX', 'ㅌ'],
      ['KeyC', 'ㅊ'],
      ['KeyV', 'ㅍ'],
      ['KeyB', 'ㅠ'],
      ['KeyN', 'ㅜ'],
      ['KeyM', 'ㅡ'],
    ])('maps %s to %s on the dubeolsik layout', (code, jamo) => {
      expect(mapKey(press(code), opts('number-hangul'))).toEqual({
        type: 'glyphs',
        glyphs: [{ kind: 'jamo', char: jamo }],
      });
    });

    it.each([
      ['KeyQ', 'ㅃ'],
      ['KeyW', 'ㅉ'],
      ['KeyE', 'ㄸ'],
      ['KeyR', 'ㄲ'],
      ['KeyT', 'ㅆ'],
      ['KeyO', 'ㅒ'],
      ['KeyP', 'ㅖ'],
    ])('maps Shift+%s to %s', (code, jamo) => {
      expect(mapKey(press(code, { shiftKey: true }), opts('number-hangul'))).toEqual({
        type: 'glyphs',
        glyphs: [{ kind: 'jamo', char: jamo }],
      });
    });

    it('keeps the base jamo when Shift is held on a key without a double form', () => {
      expect(mapKey(press('KeyK', { shiftKey: true }), opts('number-hangul'))).toEqual({
        type: 'glyphs',
        glyphs: [{ kind: 'jamo', char: 'ㅏ' }],
      });
    });

    it('does not let Shift change the latin case', () => {
      expect(mapKey(press('KeyA', { shiftKey: true }), opts('number-latin', 'lower'))).toEqual({
        type: 'glyphs',
        glyphs: [{ kind: 'latin', char: 'a' }],
      });
    });
  });

  describe('other keys', () => {
    it.each(['Space', 'Enter', 'ArrowUp', 'F5', 'Backspace', 'Comma', 'Escape', 'Tab', ''])(
      'shows a decoration for %j',
      (code) => {
        expect(mapKey(press(code), opts('number-hangul'))).toEqual({ type: 'decor' });
      },
    );

    it.each([
      'ShiftLeft',
      'ShiftRight',
      'ControlLeft',
      'ControlRight',
      'AltLeft',
      'AltRight',
      'MetaLeft',
      'CapsLock',
      'Lang1',
      'Lang2',
      'Fn',
    ])('ignores the modifier key %s', (code) => {
      expect(mapKey(press(code), opts('number-hangul'))).toEqual({ type: 'ignore' });
    });

    it.each([{ ctrlKey: true }, { altKey: true }, { metaKey: true }])(
      'ignores keys pressed together with %o (parent shortcuts)',
      (modifier) => {
        expect(mapKey(press('KeyP', modifier), opts('number-hangul'))).toEqual({ type: 'ignore' });
      },
    );
  });
});
