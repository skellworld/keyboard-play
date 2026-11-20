import { describe, expect, it } from 'vitest';
import {
  EXIT_HOLD_MS,
  HOLD_IDLE,
  holdProgress,
  isExitChord,
  isHoldComplete,
  isInExitCorner,
  markHoldFired,
  NO_KEYS,
  updateHold,
  updatePressedKeys,
  type HoldState,
  type KeyTransition,
} from './holdDetector';

function holdFor(steps: ReadonlyArray<readonly [active: boolean, now: number]>): HoldState {
  return steps.reduce<HoldState>(
    (state, [active, now]) => updateHold(state, active, now),
    HOLD_IDLE,
  );
}

describe('hold timing', () => {
  it('uses a 3 second hold', () => {
    expect(EXIT_HOLD_MS).toBe(3000);
  });

  it('completes after the condition stays active for 3 seconds', () => {
    const state = holdFor([[true, 1000]]);

    expect(isHoldComplete(state, 3999)).toBe(false);
    expect(isHoldComplete(state, 4000)).toBe(true);
  });

  it('resets when the condition is released before 3 seconds', () => {
    const state = holdFor([
      [true, 0],
      [false, 2900],
      [true, 3000],
    ]);

    expect(isHoldComplete(state, 5000)).toBe(false);
    expect(isHoldComplete(state, 6000)).toBe(true);
  });

  it('keeps the original start time while the condition stays active', () => {
    const state = holdFor([
      [true, 0],
      [true, 1000],
      [true, 2000],
    ]);

    expect(isHoldComplete(state, 3000)).toBe(true);
  });

  it('reports progress between 0 and 1', () => {
    const state = holdFor([[true, 0]]);

    expect(holdProgress(HOLD_IDLE, 500)).toBe(0);
    expect(holdProgress(state, 1500)).toBe(0.5);
    expect(holdProgress(state, 9000)).toBe(1);
  });

  it('does not start again after firing until the condition is released', () => {
    const fired = markHoldFired(holdFor([[true, 0]]));

    const stillHeld = updateHold(fired, true, 5000);
    expect(isHoldComplete(stillHeld, 9000)).toBe(false);

    const released = updateHold(stillHeld, false, 9100);
    const pressedAgain = updateHold(released, true, 9200);
    expect(isHoldComplete(pressedAgain, 12200)).toBe(true);
  });
});

describe('pressed key tracking', () => {
  function key(
    type: KeyTransition['type'],
    code: string,
    modifiers: Partial<Pick<KeyTransition, 'ctrlKey' | 'altKey'>> = {},
  ): KeyTransition {
    return { type, code, ctrlKey: false, altKey: false, ...modifiers };
  }

  it('adds codes on keydown and removes them on keyup without mutating', () => {
    const afterDown = updatePressedKeys(NO_KEYS, key('keydown', 'KeyP'));
    const afterUp = updatePressedKeys(afterDown, key('keyup', 'KeyP'));

    expect([...afterDown]).toEqual(['KeyP']);
    expect([...afterUp]).toEqual([]);
    expect([...NO_KEYS]).toEqual([]);
  });

  it('ignores events with an empty code', () => {
    expect(updatePressedKeys(NO_KEYS, key('keydown', ''))).toBe(NO_KEYS);
  });

  it('drops Ctrl/Alt whose keyup was missed, using the modifier flags of the next event', () => {
    // 창 포커스를 잃어 Ctrl·Alt의 keyup을 못 받은 상황
    const stale: ReadonlySet<string> = new Set(['ControlLeft', 'AltLeft']);

    const afterP = updatePressedKeys(stale, key('keydown', 'KeyP'));

    expect([...afterP]).toEqual(['KeyP']);
    expect(isExitChord(afterP)).toBe(false);
  });

  it('keeps Ctrl/Alt while the event says they are still held', () => {
    const held = [
      key('keydown', 'ControlLeft', { ctrlKey: true }),
      key('keydown', 'AltLeft', { ctrlKey: true, altKey: true }),
      key('keydown', 'KeyP', { ctrlKey: true, altKey: true }),
    ].reduce(updatePressedKeys, NO_KEYS);

    expect(isExitChord(held)).toBe(true);
  });
});

describe('isExitChord', () => {
  it.each([
    [['ControlLeft', 'AltLeft', 'KeyP']],
    [['ControlRight', 'AltRight', 'KeyP']],
    [['ControlLeft', 'AltRight', 'KeyP', 'KeyA']],
  ])('is true for %j', (codes) => {
    expect(isExitChord(new Set(codes))).toBe(true);
  });

  it.each([[['ControlLeft', 'AltLeft']], [['AltLeft', 'KeyP']], [['ControlLeft', 'KeyP']], [[]]])(
    'is false for %j',
    (codes) => {
      expect(isExitChord(new Set(codes))).toBe(false);
    },
  );
});

describe('isInExitCorner', () => {
  const viewport = { width: 1000 };

  it.each([
    [{ x: 999, y: 0 }, true],
    [{ x: 920, y: 80 }, true],
    [{ x: 919, y: 10 }, false],
    [{ x: 990, y: 81 }, false],
    [{ x: 10, y: 10 }, false],
    [{ x: 1000, y: 40 }, true],
    [{ x: 1001, y: 40 }, false],
    [{ x: 960, y: -1 }, false],
  ])('point %o → %s', (point, expected) => {
    expect(isInExitCorner(point, viewport)).toBe(expected);
  });

  it('supports a custom corner size', () => {
    expect(isInExitCorner({ x: 850, y: 100 }, viewport, 150)).toBe(true);
  });
});
