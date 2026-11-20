import { describe, expect, it } from 'vitest';
import {
  acceptsPlayInput,
  CONFIRM_EXIT_MS,
  INITIAL_APP_STATE,
  reduceApp,
  type AppEvent,
  type AppState,
} from './appState';

function run(events: readonly AppEvent[], from: AppState = INITIAL_APP_STATE): AppState {
  return events.reduce(reduceApp, from);
}

describe('reduceApp', () => {
  it('starts on the start screen', () => {
    expect(INITIAL_APP_STATE).toEqual({ screen: 'start' });
  });

  it('goes from start to playing', () => {
    expect(run([{ type: 'START' }])).toEqual({ screen: 'playing' });
  });

  it('pauses when fullscreen is lost while playing', () => {
    expect(run([{ type: 'START' }, { type: 'FULLSCREEN_LOST' }])).toEqual({ screen: 'paused' });
  });

  it('resumes from paused to playing', () => {
    expect(run([{ type: 'START' }, { type: 'FULLSCREEN_LOST' }, { type: 'RESUME' }])).toEqual({
      screen: 'playing',
    });
  });

  it('asks for exit confirmation when the exit hold completes while playing', () => {
    expect(run([{ type: 'START' }, { type: 'EXIT_HOLD_COMPLETED', now: 1000 }])).toEqual({
      screen: 'confirmExit',
      deadline: 1000 + CONFIRM_EXIT_MS,
      returnTo: 'playing',
    });
  });

  it('asks for exit confirmation from paused and returns there on timeout', () => {
    const state = run([
      { type: 'START' },
      { type: 'FULLSCREEN_LOST' },
      { type: 'EXIT_HOLD_COMPLETED', now: 0 },
      { type: 'TICK', now: CONFIRM_EXIT_MS },
    ]);

    expect(state).toEqual({ screen: 'paused' });
  });

  it('opens the parent menu when the exit is confirmed before the deadline', () => {
    expect(
      run([
        { type: 'START' },
        { type: 'EXIT_HOLD_COMPLETED', now: 0 },
        { type: 'EXIT_CONFIRMED', now: CONFIRM_EXIT_MS - 1 },
      ]),
    ).toEqual({ screen: 'parentMenu' });
  });

  it('refuses a confirmation that arrives at or after the deadline', () => {
    expect(
      run([
        { type: 'START' },
        { type: 'EXIT_HOLD_COMPLETED', now: 0 },
        { type: 'EXIT_CONFIRMED', now: CONFIRM_EXIT_MS },
      ]),
    ).toEqual({ screen: 'playing' });
  });

  it('does not extend the deadline when the exit hold completes again', () => {
    const confirming = run([{ type: 'START' }, { type: 'EXIT_HOLD_COMPLETED', now: 0 }]);

    expect(reduceApp(confirming, { type: 'EXIT_HOLD_COMPLETED', now: 4000 })).toBe(confirming);
  });

  it('ignores events it does not know', () => {
    const state: AppState = { screen: 'playing' };
    const unknown = { type: 'SOMETHING_ELSE' } as unknown as AppEvent;

    expect(reduceApp(state, unknown)).toBe(state);
  });

  it('stays on the confirmation until the deadline', () => {
    const confirming = run([{ type: 'START' }, { type: 'EXIT_HOLD_COMPLETED', now: 0 }]);

    expect(reduceApp(confirming, { type: 'TICK', now: CONFIRM_EXIT_MS - 1 })).toBe(confirming);
    expect(reduceApp(confirming, { type: 'TICK', now: CONFIRM_EXIT_MS })).toEqual({
      screen: 'playing',
    });
  });

  it('returns to paused instead of playing if fullscreen is lost during confirmation', () => {
    const state = run([
      { type: 'START' },
      { type: 'EXIT_HOLD_COMPLETED', now: 0 },
      { type: 'FULLSCREEN_LOST' },
      { type: 'TICK', now: CONFIRM_EXIT_MS },
    ]);

    expect(state).toEqual({ screen: 'paused' });
  });

  it('opens the parent menu from the start screen', () => {
    expect(run([{ type: 'OPEN_MENU' }])).toEqual({ screen: 'parentMenu' });
  });

  it('opens the parent menu only from the start screen', () => {
    const playing: AppState = { screen: 'playing' };

    expect(reduceApp(playing, { type: 'OPEN_MENU' })).toBe(playing);
  });

  it('restarts play from the parent menu', () => {
    const state = run([
      { type: 'START' },
      { type: 'EXIT_HOLD_COMPLETED', now: 0 },
      { type: 'EXIT_CONFIRMED', now: 1 },
      { type: 'START' },
    ]);

    expect(state).toEqual({ screen: 'playing' });
  });

  it.each<[AppState, AppEvent]>([
    [{ screen: 'start' }, { type: 'RESUME' }],
    [{ screen: 'start' }, { type: 'EXIT_HOLD_COMPLETED', now: 0 }],
    [{ screen: 'start' }, { type: 'FULLSCREEN_LOST' }],
    [{ screen: 'playing' }, { type: 'START' }],
    [{ screen: 'playing' }, { type: 'EXIT_CONFIRMED', now: 0 }],
    [{ screen: 'paused' }, { type: 'FULLSCREEN_LOST' }],
    [{ screen: 'parentMenu' }, { type: 'FULLSCREEN_LOST' }],
    [{ screen: 'parentMenu' }, { type: 'TICK', now: 99999 }],
  ])('ignores %o + %o', (state, event) => {
    expect(reduceApp(state, event)).toBe(state);
  });
});

describe('acceptsPlayInput', () => {
  it.each<[AppState, boolean]>([
    [{ screen: 'start' }, false],
    [{ screen: 'playing' }, true],
    [{ screen: 'paused' }, false],
    [{ screen: 'confirmExit', deadline: 0, returnTo: 'playing' }, false],
    [{ screen: 'parentMenu' }, false],
  ])('%o → %s', (state, expected) => {
    expect(acceptsPlayInput(state)).toBe(expected);
  });
});
