/**
 * 잠금 모드: 전체화면 + 키보드 잠금(Keyboard Lock, 지원 브라우저만) + 화면 꺼짐 방지(Wake Lock).
 * 하나가 실패해도 놀이는 계속하고, 상태만 기록해 부모 메뉴에 보여 준다.
 * 브라우저가 전체화면을 풀면(Esc 길게 누름 등) onFullscreenLost로 알린다.
 */

export type FeatureState = 'on' | 'off' | 'failed' | 'unsupported';

export interface LockStatus {
  readonly fullscreen: FeatureState;
  readonly keyboardLock: FeatureState;
  readonly wakeLock: FeatureState;
}

type LockEventType = 'fullscreenchange' | 'visibilitychange';

export interface ScreenLockDocument {
  readonly fullscreenElement: Element | null;
  readonly visibilityState: DocumentVisibilityState;
  readonly documentElement: {
    requestFullscreen?: (options?: FullscreenOptions) => Promise<void>;
  };
  exitFullscreen?: () => Promise<void>;
  addEventListener(type: LockEventType, listener: () => void): void;
  removeEventListener(type: LockEventType, listener: () => void): void;
}

interface WakeLockHandle {
  release(): Promise<void>;
}

export interface LockNavigator {
  readonly keyboard?: { lock?: () => Promise<void>; unlock?: () => void };
  readonly wakeLock?: { request(type: 'screen'): Promise<WakeLockHandle> };
}

export interface ScreenLock {
  /** 클릭·탭 처리 중에 불러야 한다 (전체화면 요청을 동기적으로 보낸다). */
  enter(): Promise<LockStatus>;
  exit(): Promise<void>;
  isFullscreen(): boolean;
  status(): LockStatus;
  onFullscreenLost(callback: () => void): () => void;
  /** 이벤트 없이 모두 풀고 정리한다. */
  dispose(): void;
}

const ALL_OFF: LockStatus = Object.freeze({
  fullscreen: 'off',
  keyboardLock: 'off',
  wakeLock: 'off',
});

export function createScreenLock(
  doc: ScreenLockDocument = document as unknown as ScreenLockDocument,
  nav: LockNavigator = navigator as unknown as LockNavigator,
): ScreenLock {
  let current: LockStatus = ALL_OFF;
  let wake: WakeLockHandle | null = null;
  /** Wake Lock 요청마다 올라가는 번호. 늦게 도착한 옛 요청의 결과는 버린다. */
  let wakeGeneration = 0;
  let wanted = false;
  let exiting = false;
  const lostListeners = new Set<() => void>();

  function startFullscreen(): Promise<FeatureState> {
    const request = doc.documentElement.requestFullscreen;
    if (typeof request !== 'function') {
      return Promise.resolve('unsupported');
    }
    try {
      return request.call(doc.documentElement, { navigationUI: 'hide' }).then(
        () => 'on' as const,
        () => 'failed' as const,
      );
    } catch {
      return Promise.resolve('failed');
    }
  }

  async function lockKeyboard(): Promise<FeatureState> {
    if (typeof nav.keyboard?.lock !== 'function') {
      return 'unsupported';
    }
    try {
      await nav.keyboard.lock();
      return 'on';
    } catch {
      return 'failed';
    }
  }

  async function releaseWake(): Promise<void> {
    const handle = wake;
    wake = null;
    await handle?.release().catch(() => undefined);
  }

  async function requestWake(): Promise<FeatureState> {
    if (!nav.wakeLock) {
      return 'unsupported';
    }
    wakeGeneration += 1;
    const generation = wakeGeneration;
    await releaseWake();
    try {
      const handle = await nav.wakeLock.request('screen');
      if (generation !== wakeGeneration || !wanted) {
        await handle.release().catch(() => undefined);
        return 'off';
      }
      wake = handle;
      return 'on';
    } catch {
      return 'failed';
    }
  }

  /** 이벤트 없이 모두 푼다 (exit, dispose 공용). */
  async function releaseAll(): Promise<void> {
    wanted = false;
    wakeGeneration += 1;
    exiting = true;
    try {
      try {
        nav.keyboard?.unlock?.();
      } catch {
        // 키보드 잠금 해제 실패는 무시한다 (전체화면이 풀리면 브라우저가 함께 푼다).
      }
      const releasing = releaseWake();
      const exitingFullscreen =
        doc.fullscreenElement && doc.exitFullscreen
          ? doc.exitFullscreen().catch(() => undefined)
          : Promise.resolve();
      await Promise.all([releasing, exitingFullscreen]);
    } finally {
      exiting = false;
      current = ALL_OFF;
    }
  }

  const onFullscreenChange = (): void => {
    if (doc.fullscreenElement || current.fullscreen !== 'on') {
      return;
    }
    // 키보드 잠금은 전체화면에서만 유지되므로 함께 꺼진다.
    current = { ...current, fullscreen: 'off', keyboardLock: 'off' };
    if (!exiting) {
      lostListeners.forEach((listener) => listener());
    }
  };

  // 화면이 숨겨지면 브라우저가 Wake Lock을 풀기 때문에 다시 보일 때 새로 받는다.
  const onVisibilityChange = (): void => {
    if (wanted && doc.visibilityState === 'visible') {
      void requestWake().then((wakeLock) => {
        if (wanted) {
          current = { ...current, wakeLock };
        }
      });
    }
  };

  doc.addEventListener('fullscreenchange', onFullscreenChange);
  doc.addEventListener('visibilitychange', onVisibilityChange);

  return {
    async enter() {
      wanted = true;
      const fullscreenRequest = startFullscreen(); // await 전에 보내야 사용자 동작으로 인정된다
      const fullscreen = await fullscreenRequest;
      if (!wanted) {
        return current;
      }
      // 바로 기록해야 아래 기다리는 동안 전체화면이 풀려도 알아챈다.
      current = { ...current, fullscreen };
      const keyboardLock = fullscreen === 'on' ? await lockKeyboard() : 'off';
      const wakeLock = wanted ? await requestWake() : 'off';
      if (!wanted) {
        return current;
      }
      const stillFullscreen = current.fullscreen === 'on';
      current = {
        fullscreen: current.fullscreen,
        keyboardLock: stillFullscreen ? keyboardLock : 'off',
        wakeLock,
      };
      return current;
    },
    exit: releaseAll,
    isFullscreen: () => doc.fullscreenElement !== null,
    status: () => current,
    onFullscreenLost(callback) {
      lostListeners.add(callback);
      return () => {
        lostListeners.delete(callback);
      };
    },
    dispose() {
      doc.removeEventListener('fullscreenchange', onFullscreenChange);
      doc.removeEventListener('visibilitychange', onVisibilityChange);
      lostListeners.clear();
      void releaseAll();
    },
  };
}
