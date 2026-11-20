import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStage, type Stage } from './stage';

const ITEM = [
  { glyph: { kind: 'jamo', char: 'ㄱ' }, info: { speech: '기역', emoji: '🐻' } },
] as const;

function makeStage(overrides: Parameters<typeof createStage>[0] = {}): Stage {
  return createStage({
    random: () => 0.5,
    viewport: () => ({ width: 1000, height: 800 }),
    lifetimeMs: 3000,
    leaveMs: 200,
    maxSprites: 3,
    ...overrides,
  });
}

describe('createStage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds a positioned glyph sprite with a size taken from the viewport', () => {
    const stage = makeStage();

    stage.spawnGlyph(ITEM);

    const sprite = stage.element.querySelector<HTMLElement>('.sprite--glyph');
    expect(sprite).not.toBeNull();
    expect(sprite?.style.left).toMatch(/px$/);
    expect(sprite?.style.top).toMatch(/px$/);
    expect(sprite?.style.getPropertyValue('--glyph-size')).toBe('224px');
    expect(stage.activeCount()).toBe(1);
  });

  it('moves a glyph sprite back on screen using its measured size', () => {
    const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(900);
    const height = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(300);
    const stage = makeStage({ random: () => 0 });

    stage.spawnGlyph(ITEM);

    const sprite = stage.element.querySelector<HTMLElement>('.sprite--glyph');
    expect(sprite?.style.left).toBe('450px');
    width.mockRestore();
    height.mockRestore();
  });

  it('removes a sprite after its lifetime', () => {
    const stage = makeStage();
    stage.spawnGlyph(ITEM);

    vi.advanceTimersByTime(2999);
    expect(stage.element.children).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(stage.element.children).toHaveLength(0);
    expect(stage.activeCount()).toBe(0);
  });

  it('places a burst at the given point', () => {
    const stage = makeStage();

    stage.spawnBurst({ x: 120, y: 340 });

    const burst = stage.element.querySelector<HTMLElement>('.sprite--burst');
    expect(burst?.style.left).toBe('120px');
    expect(burst?.style.top).toBe('340px');
  });

  it('places a burst somewhere on screen when no point is given', () => {
    const stage = makeStage();

    stage.spawnBurst();

    expect(stage.element.querySelector<HTMLElement>('.sprite--burst')?.style.left).toMatch(/px$/);
  });

  it('keeps at most maxSprites active by sending the oldest away quickly', () => {
    const stage = makeStage();

    stage.spawnGlyph(ITEM);
    stage.spawnBurst();
    stage.spawnBurst();
    stage.spawnBurst();

    expect(stage.activeCount()).toBe(3);
    const oldest = stage.element.firstElementChild;
    expect(oldest?.classList).toContain('sprite--leaving');

    vi.advanceTimersByTime(200);
    expect(stage.element.children).toHaveLength(3);
    expect(stage.element.querySelector('.sprite--glyph')).toBeNull();
  });

  it('removes everything and cancels timers on destroy', () => {
    const stage = makeStage();
    stage.spawnGlyph(ITEM);
    stage.spawnBurst();

    stage.destroy();

    expect(stage.element.children).toHaveLength(0);
    expect(stage.activeCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
