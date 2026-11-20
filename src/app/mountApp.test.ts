import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LockStatus, ScreenLock } from '../lock/screenLock';
import { mountApp } from './mountApp';

const LOCKED: LockStatus = { fullscreen: 'on', keyboardLock: 'on', wakeLock: 'on' };

function fakeLock() {
  let lost: (() => void) | undefined;
  const lock = {
    enter: vi.fn(async () => LOCKED),
    exit: vi.fn(async () => undefined),
    isFullscreen: () => true,
    status: () => LOCKED,
    onFullscreenLost: (callback: () => void) => {
      lost = callback;
      return () => undefined;
    },
    dispose: vi.fn(),
  };
  return { lock: lock as ScreenLock & typeof lock, loseFullscreen: () => lost?.() };
}

function fakeFeedback() {
  return {
    glyph: vi.fn(),
    burst: vi.fn(),
    unlock: vi.fn(),
    silence: vi.fn(),
    dispose: vi.fn(),
    hasVoice: () => true,
  };
}

function key(type: 'keydown' | 'keyup', code: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
}

function holdExitChord(): void {
  key('keydown', 'ControlLeft', { ctrlKey: true });
  key('keydown', 'AltLeft', { ctrlKey: true, altKey: true });
  key('keydown', 'KeyP', { ctrlKey: true, altKey: true });
}

describe('mountApp flow', () => {
  let root: HTMLElement;
  let frames: FrameRequestCallback[];
  let clock: number;
  let lockEnv: ReturnType<typeof fakeLock>;
  let feedback: ReturnType<typeof fakeFeedback>;
  let cleanup: () => void;

  const $ = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector) as T;
  const visible = (selector: string) => !$(selector).hidden;
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
  const runFrames = (ms: number) => {
    clock += ms;
    frames.splice(0).forEach((callback) => callback(clock));
  };
  const start = async () => {
    $<HTMLButtonElement>('.start-screen__start').click();
    await flush();
  };
  const reachConfirm = () => {
    holdExitChord();
    runFrames(0);
    runFrames(3000);
  };

  beforeEach(() => {
    root = document.createElement('div');
    document.body.append(root);
    frames = [];
    clock = 0;
    lockEnv = fakeLock();
    feedback = fakeFeedback();
    cleanup = mountApp(root, {
      storage: null,
      now: () => clock,
      requestFrame: (callback) => frames.push(callback),
      cancelFrame: () => undefined,
      screenLock: lockEnv.lock,
      feedback,
      platform: 'desktop',
    });
  });

  afterEach(() => {
    cleanup();
    root.remove();
  });

  it('shows the start screen first and does not react to keys yet', () => {
    expect(visible('.start-screen')).toBe(true);

    key('keydown', 'KeyR');

    expect(root.querySelector('.sprite')).toBeNull();
  });

  it('locks the screen and starts play from the start button', async () => {
    await start();

    expect(lockEnv.lock.enter).toHaveBeenCalledTimes(1);
    expect(visible('.start-screen')).toBe(false);
    key('keydown', 'KeyR');
    expect($('.sprite__char').textContent).toBe('ㄱ');
    expect(feedback.glyph).toHaveBeenCalled();
  });

  it('blocks browser key actions during play', async () => {
    await start();

    expect(key('keydown', 'F5').defaultPrevented).toBe(true);
  });

  it('shows the hold ring and then the exit confirmation after a 3 second hold', async () => {
    await start();
    holdExitChord();
    runFrames(0);
    runFrames(1500);

    expect(visible('.hold-ring')).toBe(true);
    runFrames(1500);
    expect(visible('.exit-confirm')).toBe(true);
  });

  it('opens the parent menu and unlocks when Enter confirms', async () => {
    await start();
    reachConfirm();
    clock += 600;

    key('keydown', 'Enter');
    await flush();

    expect(visible('.parent-menu')).toBe(true);
    expect(lockEnv.lock.exit).toHaveBeenCalled();
    expect(key('keydown', 'Tab').defaultPrevented).toBe(false);
  });

  it('opens the parent menu when the confirm button is pressed', async () => {
    await start();
    reachConfirm();
    clock += 600;

    $<HTMLButtonElement>('.exit-confirm button').click();

    expect(visible('.parent-menu')).toBe(true);
  });

  it('ignores Enter and taps in the first half second (a child mashing keys)', async () => {
    await start();
    reachConfirm();

    key('keydown', 'Enter');
    $<HTMLButtonElement>('.exit-confirm button').click();

    expect(visible('.parent-menu')).toBe(false);
  });

  it('ignores a held, auto-repeating Enter', async () => {
    await start();
    reachConfirm();
    clock += 600;

    key('keydown', 'Enter', { repeat: true });

    expect(visible('.parent-menu')).toBe(false);
  });

  it('accepts only the button, not Enter, after a corner hold', async () => {
    await start();
    window.dispatchEvent(
      new MouseEvent('pointerdown', { clientX: window.innerWidth - 5, clientY: 5, bubbles: true }),
    );
    runFrames(0);
    runFrames(3000);
    expect(visible('.exit-confirm')).toBe(true);
    clock += 600;

    key('keydown', 'Enter');
    expect(visible('.parent-menu')).toBe(false);

    $<HTMLButtonElement>('.exit-confirm button').click();
    expect(visible('.parent-menu')).toBe(true);
  });

  it('lets the frame loop rest while nothing is being held', async () => {
    await start();
    runFrames(16);

    expect(frames).toHaveLength(0);
    holdExitChord();
    expect(frames).toHaveLength(1);
  });

  it('goes back to play when nobody confirms within 5 seconds', async () => {
    await start();
    reachConfirm();

    runFrames(5000);

    expect(visible('.exit-confirm')).toBe(false);
    expect(visible('.parent-menu')).toBe(false);
  });

  it('pauses when fullscreen is lost and resumes with a tap', async () => {
    await start();

    lockEnv.loseFullscreen();
    expect(visible('.pause-overlay')).toBe(true);
    key('keydown', 'KeyR');
    expect(root.querySelector('.sprite')).toBeNull();

    clock += 600;
    $<HTMLButtonElement>('.pause-overlay').click();
    await flush();
    expect(visible('.pause-overlay')).toBe(false);
    expect(lockEnv.lock.enter).toHaveBeenCalledTimes(2);
  });

  it('ignores a tap that lands right as the pause appears', async () => {
    await start();
    lockEnv.loseFullscreen();

    $<HTMLButtonElement>('.pause-overlay').click();
    await flush();

    expect(visible('.pause-overlay')).toBe(true);
  });

  it('pauses when the browser refuses fullscreen', async () => {
    lockEnv.lock.enter.mockResolvedValueOnce({ ...LOCKED, fullscreen: 'failed' });

    await start();

    expect(visible('.pause-overlay')).toBe(true);
  });

  it('applies settings from the parent menu when play starts again', async () => {
    $<HTMLButtonElement>('.start-screen__menu').click();
    const latin = $<HTMLInputElement>('input[name="mode"][value="number-latin"]');
    latin.checked = true;
    latin.dispatchEvent(new Event('change', { bubbles: true }));

    $<HTMLButtonElement>('.parent-menu__play').click();
    await flush();
    key('keydown', 'KeyR');

    expect($('.sprite__char').textContent).toBe('R');
  });

  it('silences speech as soon as reading aloud is turned off', () => {
    $<HTMLButtonElement>('.start-screen__menu').click();
    const speech = $<HTMLInputElement>('input[name="speechOn"]');

    speech.checked = false;
    speech.dispatchEvent(new Event('change', { bubbles: true }));

    expect(feedback.silence).toHaveBeenCalled();
  });

  it('forgets held keys when the window loses focus', async () => {
    await start();
    holdExitChord();
    runFrames(0);

    window.dispatchEvent(new Event('blur'));
    runFrames(3000);

    expect(visible('.exit-confirm')).toBe(false);
  });

  it('releases everything on cleanup', async () => {
    await start();

    cleanup();
    key('keydown', 'KeyR');

    expect(root.querySelector('.sprite')).toBeNull();
    expect(feedback.dispose).toHaveBeenCalled();
    expect(lockEnv.lock.dispose).toHaveBeenCalled();
    cleanup = () => undefined;
  });
});
