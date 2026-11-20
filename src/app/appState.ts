/**
 * 화면 상태 전환 (순수 함수).
 *
 *   start ──START──► playing ◄──RESUME── paused
 *                      │  ▲                ▲ │
 *        EXIT_HOLD_    │  │ TICK(시간 초과) │ │ EXIT_HOLD_COMPLETED
 *        COMPLETED     ▼  │                │ ▼
 *                    confirmExit ──────────┘
 *                      │ EXIT_CONFIRMED
 *                      ▼
 *                   parentMenu ──START──► playing
 *
 * playing 중 FULLSCREEN_LOST → paused (나가기 확인 중이면 돌아갈 곳을 paused로 바꿈)
 */

export const CONFIRM_EXIT_MS = 5000;

export type ResumableScreen = 'playing' | 'paused';

export type AppState =
  | { readonly screen: 'start' }
  | { readonly screen: 'playing' }
  | { readonly screen: 'paused' }
  | {
      readonly screen: 'confirmExit';
      readonly deadline: number;
      readonly returnTo: ResumableScreen;
    }
  | { readonly screen: 'parentMenu' };

export type AppEvent =
  | { readonly type: 'START' }
  | { readonly type: 'FULLSCREEN_LOST' }
  | { readonly type: 'RESUME' }
  | { readonly type: 'EXIT_HOLD_COMPLETED'; readonly now: number }
  | { readonly type: 'EXIT_CONFIRMED'; readonly now: number }
  | { readonly type: 'TICK'; readonly now: number };
// 모든 now 값은 같은 시계(performance.now())를 써야 한다. deadline과 비교하기 때문.

const PLAYING: AppState = Object.freeze({ screen: 'playing' });
const PAUSED: AppState = Object.freeze({ screen: 'paused' });
const PARENT_MENU: AppState = Object.freeze({ screen: 'parentMenu' });

export const INITIAL_APP_STATE: AppState = Object.freeze({ screen: 'start' });

export function reduceApp(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case 'START':
      return state.screen === 'start' || state.screen === 'parentMenu' ? PLAYING : state;
    case 'RESUME':
      return state.screen === 'paused' ? PLAYING : state;
    case 'FULLSCREEN_LOST':
      return onFullscreenLost(state);
    case 'EXIT_HOLD_COMPLETED':
      return state.screen === 'playing' || state.screen === 'paused'
        ? { screen: 'confirmExit', deadline: event.now + CONFIRM_EXIT_MS, returnTo: state.screen }
        : state;
    case 'EXIT_CONFIRMED':
      if (state.screen !== 'confirmExit') {
        return state;
      }
      // TICK보다 늦게 처리된 확인도 시간 제한을 지킨다 (화면이 느려도 5초 규칙 유지).
      return event.now < state.deadline ? PARENT_MENU : screenFor(state.returnTo);
    case 'TICK':
      return state.screen === 'confirmExit' && event.now >= state.deadline
        ? screenFor(state.returnTo)
        : state;
    default:
      return state;
  }
}

function onFullscreenLost(state: AppState): AppState {
  if (state.screen === 'playing') {
    return PAUSED;
  }
  if (state.screen === 'confirmExit' && state.returnTo === 'playing') {
    return { ...state, returnTo: 'paused' };
  }
  return state;
}

function screenFor(screen: ResumableScreen): AppState {
  return screen === 'playing' ? PLAYING : PAUSED;
}

/** 놀이 입력(글자·효과 생성)을 받아도 되는 화면인지 */
export function acceptsPlayInput(state: AppState): boolean {
  return state.screen === 'playing';
}
