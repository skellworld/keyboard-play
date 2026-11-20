/**
 * 아이가 손바닥으로 연타하거나 키를 꾹 누를 때 화면이 폭주하지 않도록 입력을 거른다.
 * - 자동 반복(꾹 누름)은 버린다.
 * - 최근 1초 동안 받아들인 입력이 상한에 닿으면 버린다 (키보드·터치가 같은 상한을 공유).
 */

export interface RateLimitState {
  readonly accepted: readonly number[];
}

export interface InputLike {
  readonly repeat: boolean;
}

export interface InputDecision {
  readonly accepted: boolean;
  readonly state: RateLimitState;
}

export const DEFAULT_MAX_PER_SECOND = 10;
const WINDOW_MS = 1000;

export const INITIAL_RATE_LIMIT: RateLimitState = Object.freeze({ accepted: Object.freeze([]) });

export function acceptInput(
  state: RateLimitState,
  input: InputLike,
  now: number,
  maxPerSecond: number = DEFAULT_MAX_PER_SECOND,
): InputDecision {
  if (input.repeat) {
    return { accepted: false, state };
  }
  const limit = maxPerSecond > 0 ? maxPerSecond : DEFAULT_MAX_PER_SECOND; // NaN·0·음수 방지
  const recent = state.accepted.filter((time) => now - time < WINDOW_MS);
  if (recent.length >= limit) {
    return { accepted: false, state: { accepted: recent } };
  }
  return { accepted: true, state: { accepted: [...recent, now] } };
}
