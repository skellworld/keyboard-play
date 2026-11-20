import { describe, expect, it } from 'vitest';
import { EXIT_HOLD_MS } from '../input/holdDetector';
import { createExitWatcher } from './exitWatcher';

const VIEWPORT = { width: 1000, height: 800 };
const CORNER = { x: 990, y: 10 };
const MIDDLE = { x: 500, y: 400 };

function key(type: 'keydown' | 'keyup', code: string, held: { ctrl?: boolean; alt?: boolean }) {
  return { type, code, ctrlKey: held.ctrl ?? false, altKey: held.alt ?? false };
}

function pressChord(watcher: ReturnType<typeof createExitWatcher>): void {
  watcher.key(key('keydown', 'ControlLeft', { ctrl: true }));
  watcher.key(key('keydown', 'AltLeft', { ctrl: true, alt: true }));
  watcher.key(key('keydown', 'KeyP', { ctrl: true, alt: true }));
}

describe('createExitWatcher', () => {
  it('completes after Ctrl+Alt+P is held for 3 seconds', () => {
    const watcher = createExitWatcher(() => VIEWPORT);
    pressChord(watcher);

    expect(watcher.update(0)).toEqual({ progress: 0, completed: false });
    expect(watcher.update(EXIT_HOLD_MS / 2).progress).toBeCloseTo(0.5);
    expect(watcher.update(EXIT_HOLD_MS).completed).toBe(true);
  });

  it('completes after the top-right corner is held for 3 seconds', () => {
    const watcher = createExitWatcher(() => VIEWPORT);
    watcher.pointerDown(1, CORNER);

    watcher.update(0);

    expect(watcher.update(EXIT_HOLD_MS).completed).toBe(true);
  });

  it('starts over when the finger slides out of the corner', () => {
    const watcher = createExitWatcher(() => VIEWPORT);
    watcher.pointerDown(1, CORNER);
    watcher.update(0);

    watcher.pointerMove(1, MIDDLE);
    watcher.update(1000);
    watcher.pointerMove(1, CORNER);
    watcher.update(2000);

    expect(watcher.update(4000).completed).toBe(false);
    expect(watcher.update(5000).completed).toBe(true);
  });

  it('keeps holding when another finger touches and lifts elsewhere', () => {
    const watcher = createExitWatcher(() => VIEWPORT);
    watcher.pointerDown(1, CORNER);
    watcher.update(0);

    watcher.pointerDown(2, MIDDLE);
    watcher.pointerUp(2);

    expect(watcher.update(EXIT_HOLD_MS).completed).toBe(true);
  });

  it('does not let the keyboard and the corner reset each other', () => {
    const watcher = createExitWatcher(() => VIEWPORT);
    pressChord(watcher);
    watcher.pointerDown(1, CORNER);
    watcher.update(0);

    watcher.key(key('keyup', 'KeyP', { ctrl: true, alt: true }));

    expect(watcher.update(EXIT_HOLD_MS).completed).toBe(true);
  });

  it('does not complete again until everything is released', () => {
    const watcher = createExitWatcher(() => VIEWPORT);
    watcher.pointerDown(1, CORNER);
    watcher.update(0);
    watcher.update(EXIT_HOLD_MS);

    watcher.markFired();
    expect(watcher.update(EXIT_HOLD_MS * 3).completed).toBe(false);

    watcher.pointerUp(1);
    watcher.update(EXIT_HOLD_MS * 3);
    watcher.pointerDown(1, CORNER);
    watcher.update(EXIT_HOLD_MS * 4);
    expect(watcher.update(EXIT_HOLD_MS * 5).completed).toBe(true);
  });

  it('forgets held keys and fingers on reset (focus lost, page hidden)', () => {
    const watcher = createExitWatcher(() => VIEWPORT);
    pressChord(watcher);
    watcher.pointerDown(1, CORNER);
    watcher.update(0);

    watcher.reset();

    expect(watcher.update(EXIT_HOLD_MS)).toEqual({ progress: 0, completed: false });
  });

  it('tells whether the keyboard chord is held (Enter may confirm only then)', () => {
    const watcher = createExitWatcher(() => VIEWPORT);
    watcher.pointerDown(1, CORNER);
    expect(watcher.chordHeld()).toBe(false);

    pressChord(watcher);

    expect(watcher.chordHeld()).toBe(true);
  });

  it('tells whether anything is being held so the frame loop can rest', () => {
    const watcher = createExitWatcher(() => VIEWPORT);
    expect(watcher.isActive()).toBe(false);

    watcher.pointerDown(1, MIDDLE);
    expect(watcher.isActive()).toBe(false);

    watcher.pointerMove(1, CORNER);
    expect(watcher.isActive()).toBe(true);

    watcher.pointerUp(1);
    watcher.update(0);
    expect(watcher.isActive()).toBe(false);
  });

  it('ignores unknown fingers', () => {
    const watcher = createExitWatcher(() => VIEWPORT);

    expect(() => {
      watcher.pointerUp(42);
      watcher.pointerMove(42, CORNER);
    }).not.toThrow();
    expect(watcher.update(EXIT_HOLD_MS).completed).toBe(false);
  });
});
