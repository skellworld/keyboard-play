import { describe, expect, it } from 'vitest';
import { acceptInput, INITIAL_RATE_LIMIT, type RateLimitState } from './inputFilter';

const FRESH = { repeat: false };

function pressAt(times: readonly number[], maxPerSecond?: number): boolean[] {
  let state: RateLimitState = INITIAL_RATE_LIMIT;
  return times.map((now) => {
    const decision = acceptInput(state, FRESH, now, maxPerSecond);
    state = decision.state;
    return decision.accepted;
  });
}

describe('acceptInput', () => {
  it('rejects auto-repeat events without using up the budget', () => {
    const decision = acceptInput(INITIAL_RATE_LIMIT, { repeat: true }, 0);

    expect(decision.accepted).toBe(false);
    expect(decision.state).toBe(INITIAL_RATE_LIMIT);
  });

  it('accepts fast repeated presses (128ms apart) while under the limit', () => {
    expect(pressAt([0, 128, 256, 384])).toEqual([true, true, true, true]);
  });

  it('accepts up to 10 inputs per second and rejects the 11th', () => {
    const times = Array.from({ length: 11 }, (_, k) => k * 10);

    const results = pressAt(times);

    expect(results.slice(0, 10)).toEqual(Array(10).fill(true));
    expect(results[10]).toBe(false);
  });

  it('accepts again once the oldest input is a full second old', () => {
    const burst = Array.from({ length: 10 }, (_, k) => k * 10);

    expect(pressAt([...burst, 999, 1000])).toEqual([...Array(10).fill(true), false, true]);
  });

  it('supports a custom limit', () => {
    expect(pressAt([0, 1, 2], 2)).toEqual([true, true, false]);
  });

  it.each([Number.NaN, 0, -3])('falls back to the default limit for an invalid limit %d', (bad) => {
    const times = Array.from({ length: 11 }, (_, k) => k);

    expect(pressAt(times, bad)).toEqual([...Array(10).fill(true), false]);
  });

  it('drops expired entries from the state even when rejecting', () => {
    const full: RateLimitState = { accepted: Array.from({ length: 10 }, (_, k) => 500 + k) };

    const decision = acceptInput(full, FRESH, 1200);

    expect(decision.accepted).toBe(false);
    expect(decision.state.accepted).toHaveLength(10);
    expect(acceptInput(full, FRESH, 1500).state.accepted).toEqual([
      501, 502, 503, 504, 505, 506, 507, 508, 509, 1500,
    ]);
  });

  it('does not mutate the previous state', () => {
    const frozen: RateLimitState = Object.freeze({ accepted: Object.freeze([0]) });

    const decision = acceptInput(frozen, FRESH, 5);

    expect(frozen.accepted).toEqual([0]);
    expect(decision.state.accepted).toEqual([0, 5]);
  });
});
