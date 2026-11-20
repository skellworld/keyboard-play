import { describe, expect, it, vi } from 'vitest';
import { createScreenLock, type LockNavigator, type ScreenLockDocument } from './screenLock';

function fakeEnv(
  options: {
    fullscreenFails?: boolean;
    noKeyboard?: boolean;
    noWake?: boolean;
    /** 키보드 잠금 응답을 테스트가 직접 풀 때까지 붙잡아 둔다 */
    keyboardLockGate?: Promise<void>;
  } = {},
) {
  const listeners = new Map<string, Set<() => void>>();
  const fire = (type: string) => listeners.get(type)?.forEach((listener) => listener());
  const root = {} as Element;
  const doc = {
    fullscreenElement: null as Element | null,
    visibilityState: 'visible' as DocumentVisibilityState,
    documentElement: {
      requestFullscreen: vi.fn(async () => {
        if (options.fullscreenFails) {
          throw new Error('denied');
        }
        doc.fullscreenElement = root;
        fire('fullscreenchange');
      }),
    },
    exitFullscreen: vi.fn(async () => {
      doc.fullscreenElement = null;
      fire('fullscreenchange');
    }),
    addEventListener: (type: string, listener: () => void) => {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener: (type: string, listener: () => void) => {
      listeners.get(type)?.delete(listener);
    },
  };
  const sentinel = { release: vi.fn(async () => undefined) };
  const nav = {
    keyboard: options.noKeyboard
      ? undefined
      : { lock: vi.fn(async () => options.keyboardLockGate), unlock: vi.fn() },
    wakeLock: options.noWake ? undefined : { request: vi.fn(async () => sentinel) },
  };
  const lock = createScreenLock(doc as ScreenLockDocument, nav as LockNavigator);
  const loseFullscreen = () => {
    doc.fullscreenElement = null;
    fire('fullscreenchange');
  };
  const setVisibility = (state: DocumentVisibilityState) => {
    doc.visibilityState = state;
    fire('visibilitychange');
  };
  return { lock, doc, nav, sentinel, listeners, loseFullscreen, setVisibility };
}

describe('createScreenLock', () => {
  it('turns on fullscreen, keyboard lock and the screen wake lock', async () => {
    const { lock, nav } = fakeEnv();

    const status = await lock.enter();

    expect(status).toEqual({ fullscreen: 'on', keyboardLock: 'on', wakeLock: 'on' });
    expect(nav.keyboard?.lock).toHaveBeenCalled();
    expect(lock.isFullscreen()).toBe(true);
  });

  it('asks for fullscreen synchronously so the click still counts as a user gesture', () => {
    const { lock, doc } = fakeEnv();

    void lock.enter();

    expect(doc.documentElement.requestFullscreen).toHaveBeenCalled();
  });

  it('keeps going when fullscreen is refused', async () => {
    const { lock, nav } = fakeEnv({ fullscreenFails: true });

    const status = await lock.enter();

    expect(status.fullscreen).toBe('failed');
    expect(status.keyboardLock).toBe('off');
    expect(nav.keyboard?.lock).not.toHaveBeenCalled();
    expect(status.wakeLock).toBe('on');
  });

  it('reports features the browser does not have', async () => {
    const { lock } = fakeEnv({ noKeyboard: true, noWake: true });

    const status = await lock.enter();

    expect(status).toEqual({
      fullscreen: 'on',
      keyboardLock: 'unsupported',
      wakeLock: 'unsupported',
    });
  });

  it('releases everything on exit without reporting it as a lost fullscreen', async () => {
    const { lock, doc, nav, sentinel } = fakeEnv();
    const lost = vi.fn();
    lock.onFullscreenLost(lost);
    await lock.enter();

    await lock.exit();

    expect(nav.keyboard?.unlock).toHaveBeenCalled();
    expect(sentinel.release).toHaveBeenCalled();
    expect(doc.exitFullscreen).toHaveBeenCalled();
    expect(lock.status()).toEqual({ fullscreen: 'off', keyboardLock: 'off', wakeLock: 'off' });
    expect(lost).not.toHaveBeenCalled();
  });

  it('reports a fullscreen that the browser ended (e.g. long Esc press)', async () => {
    const { lock, loseFullscreen } = fakeEnv();
    const lost = vi.fn();
    lock.onFullscreenLost(lost);
    await lock.enter();

    loseFullscreen();

    expect(lost).toHaveBeenCalledTimes(1);
    expect(lock.status().fullscreen).toBe('off');
  });

  it('takes the wake lock again when the page becomes visible', async () => {
    const { lock, nav, setVisibility } = fakeEnv();
    await lock.enter();

    setVisibility('hidden');
    setVisibility('visible');

    await vi.waitFor(() => expect(nav.wakeLock?.request).toHaveBeenCalledTimes(2));
  });

  it('removes its listeners on dispose', async () => {
    const { lock, listeners } = fakeEnv();
    await lock.enter();

    lock.dispose();

    const remaining = [...listeners.values()].reduce((sum, set) => sum + set.size, 0);
    expect(remaining).toBe(0);
  });

  it('reports a fullscreen lost while the keyboard lock is still being set up', async () => {
    let releaseKeyboard: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseKeyboard = resolve;
    });
    const { lock, nav, loseFullscreen } = fakeEnv({ keyboardLockGate: gate });
    const lost = vi.fn();
    lock.onFullscreenLost(lost);

    const entering = lock.enter();
    await vi.waitFor(() => expect(nav.keyboard?.lock).toHaveBeenCalled());
    loseFullscreen();
    releaseKeyboard();
    const status = await entering;

    expect(lost).toHaveBeenCalledTimes(1);
    expect(status.fullscreen).toBe('off');
    expect(status.keyboardLock).toBe('off');
  });

  it('releases the previous wake lock before taking a new one', async () => {
    const { lock, sentinel } = fakeEnv();
    await lock.enter();

    await lock.enter();

    expect(sentinel.release).toHaveBeenCalledTimes(1);
  });

  it('leaves nothing held when exit happens while entering', async () => {
    const { lock, nav, sentinel } = fakeEnv();

    const entering = lock.enter();
    await lock.exit();
    await entering;

    expect(lock.status()).toEqual({ fullscreen: 'off', keyboardLock: 'off', wakeLock: 'off' });
    expect(sentinel.release.mock.calls.length).toBe(nav.wakeLock?.request.mock.calls.length);
  });

  it('releases everything on dispose', async () => {
    const { lock, nav, sentinel, doc } = fakeEnv();
    await lock.enter();

    lock.dispose();
    await Promise.resolve();

    expect(nav.keyboard?.unlock).toHaveBeenCalled();
    expect(sentinel.release).toHaveBeenCalled();
    expect(doc.exitFullscreen).toHaveBeenCalled();
  });
});
