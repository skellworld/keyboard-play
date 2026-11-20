import { createFeedback, type Feedback } from '../audio/feedback';
import { createSfx } from '../audio/sfx';
import { createSpeaker } from '../audio/speech';
import type { KeyTransition } from '../input/holdDetector';
import { armHistoryTrap, installGuards } from '../lock/guards';
import { createScreenLock, type LockStatus, type ScreenLock } from '../lock/screenLock';
import { createStage } from '../render/stage';
import { createLiveSettings } from '../settings/liveSettings';
import { getSafeStorage } from '../settings/settingsStore';
import { createExitConfirm } from '../ui/exitConfirm';
import { createExitCornerMarker, createParentHint } from '../ui/hint';
import { createHoldRing } from '../ui/holdRing';
import { createParentMenu } from '../ui/parentMenu';
import { createPauseOverlay } from '../ui/pauseOverlay';
import { createStartScreen, detectPlatform, type Platform } from '../ui/startScreen';
import { INITIAL_APP_STATE, reduceApp, type AppEvent, type AppState } from './appState';
import { createExitWatcher } from './exitWatcher';
import { createPlayController } from './playController';

const APP_TITLE = '키보드 놀이';
/** 잠금이 걸려 있고 나가기 판정이 돌아가는 화면 */
const LOCKED_SCREENS: ReadonlySet<AppState['screen']> = new Set([
  'playing',
  'paused',
  'confirmExit',
]);
const CONFIRM_KEYS: ReadonlySet<string> = new Set(['Enter', 'NumpadEnter']);
const MS_PER_SECOND = 1000;
/** 확인 화면·일시정지 화면이 뜬 직후의 입력은 받지 않는다 (아이가 마구 누르던 손이 그대로 닿는 것 방지) */
const ARRIVAL_GRACE_MS = 500;

export interface MountOptions {
  /** 생략하면 localStorage를 안전하게 사용하고, null이면 저장하지 않는다. */
  readonly storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  readonly random?: () => number;
  /** performance.now()와 같은 시계 */
  readonly now?: () => number;
  readonly feedback?: Feedback;
  readonly screenLock?: ScreenLock;
  readonly requestFrame?: (callback: FrameRequestCallback) => number;
  readonly cancelFrame?: (id: number) => void;
  readonly platform?: Platform;
}

function createTitle(): HTMLElement {
  const title = document.createElement('h1');
  title.className = 'visually-hidden';
  title.textContent = APP_TITLE;
  return title;
}

function windowViewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function toTransition(event: KeyboardEvent): KeyTransition {
  return {
    type: event.type === 'keyup' ? 'keyup' : 'keydown',
    code: event.code,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
  };
}

function pointerIdOf(event: PointerEvent): number {
  return Number.isFinite(event.pointerId) ? event.pointerId : 0;
}

function pointOf(event: PointerEvent) {
  return { x: event.clientX, y: event.clientY };
}

/**
 * 앱 전체를 root에 그리고 화면 전환·잠금·나가기·입력을 연결한다. 반환된 함수를 부르면 정리한다.
 * 키 처리 순서(02-plan 통합 규칙 1): 나가기 판정에 먼저 → 확인 화면의 Enter → 놀이 입력.
 */
export function mountApp(root: HTMLElement, options: MountOptions = {}): () => void {
  const now = options.now ?? (() => performance.now());
  const random = options.random ?? Math.random;
  const requestFrame = options.requestFrame ?? ((cb) => window.requestAnimationFrame(cb));
  const cancelFrame = options.cancelFrame ?? ((id) => window.cancelAnimationFrame(id));
  const settings = createLiveSettings(
    options.storage === undefined ? getSafeStorage() : options.storage,
  );
  const feedback = options.feedback ?? createFeedback(createSfx(), createSpeaker(), settings.get);
  const screenLock = options.screenLock ?? createScreenLock();
  const stage = createStage({ random, viewport: windowViewport });
  const controller = createPlayController({
    stage,
    feedback,
    getSettings: settings.get,
    now,
    viewport: windowViewport,
  });
  const watcher = createExitWatcher(windowViewport);
  const ring = createHoldRing();

  let state: AppState = INITIAL_APP_STATE;
  let lastLock: LockStatus = screenLock.status();
  let frameId: number | null = null;
  /** 지금 화면이 나타난 시각 (확인·일시정지 화면의 입력 유예 계산용) */
  let screenShownAt = 0;
  /** Enter로 확인해도 되는지: Ctrl+Alt+P로 나가기를 했을 때만 (모서리 터치였다면 버튼만) */
  let enterMayConfirm = false;

  const settled = (): boolean => now() - screenShownAt >= ARRIVAL_GRACE_MS;
  const confirm = createExitConfirm(() => {
    if (settled()) {
      dispatch({ type: 'EXIT_CONFIRMED', now: now() });
    }
  });
  const startScreen = createStartScreen({
    platform: options.platform ?? detectPlatform(navigator.userAgent),
    onStart: () => beginPlay({ type: 'START' }),
    onOpenMenu: () => dispatch({ type: 'OPEN_MENU' }),
  });
  const pauseOverlay = createPauseOverlay(() => {
    if (settled()) {
      beginPlay({ type: 'RESUME' });
    }
  });
  const menu = createParentMenu({
    settings,
    getStatus: () => ({ lock: lastLock, voice: feedback.hasVoice() ? 'available' : 'missing' }),
    onPlay: () => beginPlay({ type: 'START' }),
  });

  root.replaceChildren(
    createTitle(),
    createParentHint(),
    stage.element,
    createExitCornerMarker(),
    ring.element,
    startScreen,
    pauseOverlay,
    confirm.element,
    menu.element,
  );

  /** 클릭·탭 처리 안에서 불린다: 전체화면 요청을 바로 보내야 사용자 동작으로 인정된다. */
  function beginPlay(event: AppEvent): void {
    feedback.unlock();
    armHistoryTrap(window);
    const entering = screenLock.enter();
    dispatch(event);
    void entering.then(
      (status) => {
        lastLock = status;
        // 전체화면을 거부당하면 창 모드로 놀지 않도록 일시정지 화면으로 (지원 안 하는 브라우저는 그대로 놀이).
        if (status.fullscreen === 'failed' && state.screen === 'playing') {
          dispatch({ type: 'FULLSCREEN_LOST' });
        }
      },
      () => undefined,
    );
  }

  function dispatch(event: AppEvent): void {
    const previous = state;
    state = reduceApp(state, event);
    if (state === previous) {
      return;
    }
    if (state.screen !== previous.screen) {
      screenShownAt = now();
    }
    render();
    onTransition(previous, state);
    scheduleFrame();
  }

  function onTransition(previous: AppState, next: AppState): void {
    if (next.screen === 'confirmExit' && previous.screen !== 'confirmExit') {
      enterMayConfirm = watcher.chordHeld();
      watcher.markFired();
      confirm.show(windowViewport(), random, enterMayConfirm);
    }
    if (next.screen === 'parentMenu') {
      if (previous.screen === 'confirmExit') {
        watcher.reset();
        void screenLock.exit().catch(() => undefined);
      }
      menu.refresh();
    }
  }

  function render(): void {
    startScreen.hidden = state.screen !== 'start';
    pauseOverlay.hidden = state.screen !== 'paused';
    menu.element.hidden = state.screen !== 'parentMenu';
    if (state.screen !== 'confirmExit') {
      confirm.hide();
    }
    if (!LOCKED_SCREENS.has(state.screen)) {
      ring.setProgress(0);
    }
  }

  /** 누르고 있는 것이 있거나 확인 화면일 때만 프레임을 돌린다 (태블릿 배터리 절약). */
  function scheduleFrame(): void {
    const needed =
      LOCKED_SCREENS.has(state.screen) && (state.screen === 'confirmExit' || watcher.isActive());
    if (frameId === null && needed) {
      frameId = requestFrame(onFrame);
    }
  }

  /** 매 프레임: 나가기 판정 진행, 확인 화면의 남은 시간. */
  function onFrame(): void {
    frameId = null;
    if (!LOCKED_SCREENS.has(state.screen)) {
      return;
    }
    const time = now();
    const reading = watcher.update(time);
    if (state.screen === 'confirmExit') {
      ring.setProgress(0);
      const secondsLeft = Math.ceil((state.deadline - time) / MS_PER_SECOND);
      confirm.setSecondsLeft(Math.max(0, secondsLeft));
      dispatch({ type: 'TICK', now: time });
    } else {
      ring.setProgress(reading.progress);
      if (reading.completed) {
        dispatch({ type: 'EXIT_HOLD_COMPLETED', now: time });
      }
    }
    scheduleFrame();
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    watcher.key(toTransition(event));
    scheduleFrame();
    if (state.screen === 'confirmExit') {
      const confirmsExit =
        CONFIRM_KEYS.has(event.code) && !event.repeat && enterMayConfirm && settled();
      if (confirmsExit) {
        dispatch({ type: 'EXIT_CONFIRMED', now: now() });
      }
      return;
    }
    if (state.screen === 'playing') {
      feedback.unlock();
      controller.handleKeyDown(event);
    }
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    watcher.key(toTransition(event));
    scheduleFrame();
  };
  const onWindowPointerDown = (event: PointerEvent): void => {
    watcher.pointerDown(pointerIdOf(event), pointOf(event));
    scheduleFrame();
  };
  const onPointerMove = (event: PointerEvent): void => {
    watcher.pointerMove(pointerIdOf(event), pointOf(event));
    scheduleFrame();
  };
  const onPointerEnd = (event: PointerEvent): void => watcher.pointerUp(pointerIdOf(event));
  const onStagePointerDown = (event: PointerEvent): void => {
    if (state.screen === 'playing') {
      feedback.unlock();
      controller.handlePointerDown(pointOf(event));
    }
  };
  const onBlur = (): void => watcher.reset();
  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      watcher.reset();
      feedback.silence();
    }
  };

  const windowListeners: ReadonlyArray<readonly [string, EventListener, boolean]> = [
    ['keydown', onKeyDown as EventListener, false],
    ['keyup', onKeyUp as EventListener, false],
    ['pointerdown', onWindowPointerDown as EventListener, true],
    ['pointermove', onPointerMove as EventListener, false],
    ['pointerup', onPointerEnd as EventListener, false],
    ['pointercancel', onPointerEnd as EventListener, false],
    ['lostpointercapture', onPointerEnd as EventListener, false],
    ['blur', onBlur, false],
  ];
  windowListeners.forEach(([type, listener, capture]) =>
    window.addEventListener(type, listener, { capture }),
  );
  document.addEventListener('visibilitychange', onVisibilityChange);
  stage.element.addEventListener('pointerdown', onStagePointerDown);
  const removeGuards = installGuards(window, () => LOCKED_SCREENS.has(state.screen));
  const stopLostListener = screenLock.onFullscreenLost(() => {
    watcher.reset();
    dispatch({ type: 'FULLSCREEN_LOST' });
  });
  const stopSettingsListener = settings.subscribe((current) => {
    if (!current.speechOn) {
      feedback.silence();
    }
  });

  render();

  return () => {
    windowListeners.forEach(([type, listener, capture]) =>
      window.removeEventListener(type, listener, { capture }),
    );
    document.removeEventListener('visibilitychange', onVisibilityChange);
    stage.element.removeEventListener('pointerdown', onStagePointerDown);
    if (frameId !== null) {
      cancelFrame(frameId);
      frameId = null;
    }
    removeGuards();
    stopLostListener();
    stopSettingsListener();
    stage.destroy();
    feedback.dispose();
    screenLock.dispose();
  };
}
