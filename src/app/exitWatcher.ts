import {
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
  type Point,
  type PressedKeys,
  type Viewport,
} from '../input/holdDetector';

export interface HoldReading {
  /** 0 ~ 1 */
  readonly progress: number;
  readonly completed: boolean;
}

/**
 * 부모용 나가기 감지 (02-plan 통합 규칙 2·3·4).
 * - 키보드 조합(Ctrl+Alt+P)과 모서리 터치를 하나의 HoldState로 합친다: active = 조합 || 모서리.
 * - 손가락마다(pointerId) 모서리 안인지 따로 기억한다.
 * - 포커스를 잃거나 화면이 숨겨지면 reset()으로 모두 잊는다.
 */
export interface ExitWatcher {
  key(event: KeyTransition): void;
  pointerDown(id: number, point: Point): void;
  pointerMove(id: number, point: Point): void;
  pointerUp(id: number): void;
  reset(): void;
  update(now: number): HoldReading;
  markFired(): void;
  /** Ctrl+Alt+P가 지금 눌려 있는지 (Enter로 확인을 허락할지 정할 때) */
  chordHeld(): boolean;
  /** 무언가 누르고 있거나 판정이 진행 중인지 (아니면 프레임 반복을 쉰다) */
  isActive(): boolean;
}

export function createExitWatcher(viewport: () => Viewport): ExitWatcher {
  let keys: PressedKeys = NO_KEYS;
  let fingers: ReadonlyMap<number, boolean> = new Map();
  let hold: HoldState = HOLD_IDLE;

  function setFinger(id: number, point: Point): void {
    fingers = new Map([...fingers, [id, isInExitCorner(point, viewport())]]);
  }

  function holding(): boolean {
    return isExitChord(keys) || [...fingers.values()].some(Boolean);
  }

  return {
    key(event) {
      keys = updatePressedKeys(keys, event);
    },
    pointerDown(id, point) {
      setFinger(id, point);
    },
    pointerMove(id, point) {
      if (fingers.has(id)) {
        setFinger(id, point);
      }
    },
    pointerUp(id) {
      if (fingers.has(id)) {
        fingers = new Map([...fingers].filter(([fingerId]) => fingerId !== id));
      }
    },
    reset() {
      keys = NO_KEYS;
      fingers = new Map();
      hold = HOLD_IDLE;
    },
    chordHeld() {
      return isExitChord(keys);
    },
    isActive() {
      return holding() || hold.since !== null;
    },
    update(now) {
      hold = updateHold(hold, holding(), now);
      return { progress: holdProgress(hold, now), completed: isHoldComplete(hold, now) };
    },
    markFired() {
      hold = markHoldFired(hold);
    },
  };
}
