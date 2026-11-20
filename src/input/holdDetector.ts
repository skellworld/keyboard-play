/**
 * 부모용 나가기 판정: Ctrl+Alt+P 또는 오른쪽 위 모서리를 3초 동안 계속 누르면 완료.
 * 상태는 불변 객체로 다루고, 시간(now)은 호출하는 쪽에서 넣어 준다 (테스트 가능).
 */

export const EXIT_HOLD_MS = 3000;
export const EXIT_CORNER_PX = 80;

export interface HoldState {
  /** 조건이 계속 만족되기 시작한 시각. 만족하지 않으면 null. */
  readonly since: number | null;
  /** 한 번 완료된 뒤에는 손을 뗄 때까지 다시 시작하지 않는다. */
  readonly armed: boolean;
}

export const HOLD_IDLE: HoldState = Object.freeze({ since: null, armed: true });

export function updateHold(state: HoldState, active: boolean, now: number): HoldState {
  if (!active) {
    return state.since === null && state.armed ? state : HOLD_IDLE;
  }
  if (!state.armed || state.since !== null) {
    return state;
  }
  return { since: now, armed: true };
}

export function holdProgress(
  state: HoldState,
  now: number,
  durationMs: number = EXIT_HOLD_MS,
): number {
  if (state.since === null) {
    return 0;
  }
  return Math.min(1, Math.max(0, (now - state.since) / durationMs));
}

export function isHoldComplete(
  state: HoldState,
  now: number,
  durationMs: number = EXIT_HOLD_MS,
): boolean {
  return holdProgress(state, now, durationMs) >= 1;
}

/** 완료를 처리한 뒤 호출: 손을 뗄 때까지 다시 완료되지 않게 한다. */
export function markHoldFired(state: HoldState): HoldState {
  return { ...state, since: null, armed: false };
}

// ---------- 눌린 키 추적 ----------

export type PressedKeys = ReadonlySet<string>;

export interface KeyTransition {
  readonly type: 'keydown' | 'keyup';
  readonly code: string;
  /** 이벤트 시점에 Ctrl/Alt가 실제로 눌려 있는지 (KeyboardEvent.ctrlKey / altKey) */
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
}

/** 빈 집합. 창 포커스를 잃거나 전체화면이 풀리면 이 값으로 초기화한다. */
export const NO_KEYS: PressedKeys = new Set<string>();

const CTRL_CODES: readonly string[] = ['ControlLeft', 'ControlRight'];
const ALT_CODES: readonly string[] = ['AltLeft', 'AltRight'];

export function updatePressedKeys(keys: PressedKeys, event: KeyTransition): PressedKeys {
  const healed = dropStaleModifiers(keys, event);
  if (event.code === '') {
    return healed;
  }
  const isDown = healed.has(event.code);
  if (event.type === 'keydown') {
    return isDown ? healed : new Set([...healed, event.code]);
  }
  return isDown ? new Set([...healed].filter((code) => code !== event.code)) : healed;
}

/** keyup을 놓친 Ctrl/Alt를 이벤트의 수식키 플래그로 바로잡는다 (포커스 이동 등으로 생김). */
function dropStaleModifiers(keys: PressedKeys, event: KeyTransition): PressedKeys {
  const released = [...(event.ctrlKey ? [] : CTRL_CODES), ...(event.altKey ? [] : ALT_CODES)];
  const stale = released.filter((code) => keys.has(code));
  return stale.length === 0 ? keys : new Set([...keys].filter((code) => !stale.includes(code)));
}

export function isExitChord(keys: PressedKeys): boolean {
  const ctrl = keys.has('ControlLeft') || keys.has('ControlRight');
  const alt = keys.has('AltLeft') || keys.has('AltRight');
  return ctrl && alt && keys.has('KeyP');
}

// ---------- 모서리 터치 ----------

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Viewport {
  readonly width: number;
}

export function isInExitCorner(
  point: Point,
  viewport: Viewport,
  size: number = EXIT_CORNER_PX,
): boolean {
  const inX = point.x >= viewport.width - size && point.x <= viewport.width;
  const inY = point.y >= 0 && point.y <= size;
  return inX && inY;
}
