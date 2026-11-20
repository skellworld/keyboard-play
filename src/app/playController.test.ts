import { describe, expect, it, vi } from 'vitest';
import type { KeyPress } from '../input/keymap';
import type { Stage } from '../render/stage';
import { DEFAULT_SETTINGS, type Settings } from '../settings/settingsStore';
import { createPlayController, type KeyInput } from './playController';

function fakeStage() {
  return {
    spawnGlyph: vi.fn<Stage['spawnGlyph']>(),
    spawnBurst: vi.fn<Stage['spawnBurst']>(),
  };
}

function key(code: string, extra: Partial<KeyPress & { repeat: boolean }> = {}): KeyInput {
  return {
    code,
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    repeat: false,
    ...extra,
  };
}

function setup(settings: Partial<Settings> = {}) {
  const stage = fakeStage();
  let clock = 0;
  const controller = createPlayController({
    stage,
    getSettings: () => ({ ...DEFAULT_SETTINGS, ...settings }),
    now: () => clock,
    viewport: () => ({ width: 1000, height: 800 }),
  });
  const advance = (ms: number) => {
    clock += ms;
  };
  return { stage, controller, advance };
}

describe('createPlayController keyboard', () => {
  it('spawns the jamo with its speech and emoji for a letter key', () => {
    const { stage, controller } = setup();

    controller.handleKeyDown(key('KeyR'));

    expect(stage.spawnGlyph).toHaveBeenCalledWith([
      { glyph: { kind: 'jamo', char: 'ㄱ' }, info: { speech: '기역', emoji: '🐻' } },
    ]);
  });

  it('follows the display mode setting', () => {
    const { stage, controller } = setup({ mode: 'number-latin', letterCase: 'lower' });

    controller.handleKeyDown(key('KeyR'));

    expect(stage.spawnGlyph.mock.calls[0]?.[0][0]?.glyph).toEqual({ kind: 'latin', char: 'r' });
  });

  it('spawns a burst for a non-glyph key', () => {
    const { stage, controller } = setup();

    controller.handleKeyDown(key('Space'));

    expect(stage.spawnBurst).toHaveBeenCalledWith();
    expect(stage.spawnGlyph).not.toHaveBeenCalled();
  });

  it('ignores auto-repeat and parent shortcuts', () => {
    const { stage, controller } = setup();

    controller.handleKeyDown(key('KeyR', { repeat: true }));
    controller.handleKeyDown(key('KeyP', { ctrlKey: true, altKey: true }));

    expect(stage.spawnGlyph).not.toHaveBeenCalled();
    expect(stage.spawnBurst).not.toHaveBeenCalled();
  });

  it('limits spawns to 10 per second', () => {
    const { stage, controller, advance } = setup();

    for (let k = 0; k < 12; k += 1) {
      controller.handleKeyDown(key('KeyR'));
      advance(10);
    }

    expect(stage.spawnGlyph).toHaveBeenCalledTimes(10);
  });

  it('does not let ignored modifier keys use up the limit', () => {
    const { stage, controller } = setup();

    for (let k = 0; k < 20; k += 1) {
      controller.handleKeyDown(key('ShiftLeft', { shiftKey: true }));
    }
    controller.handleKeyDown(key('KeyR'));

    expect(stage.spawnGlyph).toHaveBeenCalledTimes(1);
  });
});

describe('createPlayController touch', () => {
  it('spawns a burst where the screen was touched', () => {
    const { stage, controller } = setup();

    controller.handlePointerDown({ x: 300, y: 400 });

    expect(stage.spawnBurst).toHaveBeenCalledWith({ x: 300, y: 400 });
  });

  it('ignores touches in the parent exit corner', () => {
    const { stage, controller } = setup();

    controller.handlePointerDown({ x: 990, y: 10 });

    expect(stage.spawnBurst).not.toHaveBeenCalled();
  });

  it('ignores touches when touch reactions are turned off', () => {
    const { stage, controller } = setup({ touchOn: false });

    controller.handlePointerDown({ x: 300, y: 400 });

    expect(stage.spawnBurst).not.toHaveBeenCalled();
  });

  it('shares the per-second limit with the keyboard', () => {
    const { stage, controller } = setup();

    for (let k = 0; k < 10; k += 1) {
      controller.handleKeyDown(key('KeyR'));
    }
    controller.handlePointerDown({ x: 300, y: 400 });

    expect(stage.spawnBurst).not.toHaveBeenCalled();
  });
});
