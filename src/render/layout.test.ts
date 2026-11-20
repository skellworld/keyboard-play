import { describe, expect, it } from 'vitest';
import {
  fitPointInside,
  glyphFontSize,
  glyphSpriteSize,
  pickIndex,
  pickSpawnPoint,
} from './layout';

const LANDSCAPE = { width: 1280, height: 800 };
const PORTRAIT = { width: 800, height: 1280 };

describe('glyphFontSize', () => {
  it('uses 28% of the height on a landscape screen', () => {
    expect(glyphFontSize(LANDSCAPE)).toBeCloseTo(224);
  });

  it('is limited by the width on a narrow portrait screen', () => {
    // 800x1280 세로 화면: 글자 높이(약 0.7em)가 화면 높이의 20% 이상이 되도록 너비의 50%까지
    expect(glyphFontSize(PORTRAIT)).toBeCloseTo(358.4);
    expect(glyphFontSize({ width: 400, height: 1280 })).toBeCloseTo(200);
  });

  it('shrinks so that several glyphs side by side still fit the width', () => {
    const one = glyphFontSize({ width: 600, height: 1280 }, 1);
    const two = glyphFontSize({ width: 600, height: 1280 }, 2);

    expect(two).toBeLessThan(one);
    expect(glyphSpriteSize(two, 2).width).toBeLessThanOrEqual(600 * 0.5 + 0.001);
  });
});

describe('glyphSpriteSize', () => {
  it('grows wider with more glyphs and leaves room for the emoji row', () => {
    const one = glyphSpriteSize(200, 1);
    const two = glyphSpriteSize(200, 2);

    expect(two.width).toBeGreaterThan(one.width);
    expect(one.height).toBeGreaterThan(200);
  });
});

describe('pickSpawnPoint', () => {
  const sprite = { width: 200, height: 300 };

  it('keeps the whole sprite on screen at the smallest random value', () => {
    expect(pickSpawnPoint(LANDSCAPE, sprite, () => 0)).toEqual({ x: 100, y: 150 });
  });

  it('keeps the whole sprite on screen at the largest random value', () => {
    const point = pickSpawnPoint(LANDSCAPE, sprite, () => 0.999999);

    expect(point.x).toBeCloseTo(1180, 0);
    expect(point.y).toBeCloseTo(650, 0);
  });

  it('prefers the candidate farthest from sprites already on screen', () => {
    // 후보 1: random 0 → (100,150), 후보 2: random 1 → (1180,650)
    const values = [0, 0, 0.999999, 0.999999];
    let call = 0;
    const random = () => values[call++ % values.length] ?? 0;

    const point = pickSpawnPoint(LANDSCAPE, sprite, random, [{ x: 120, y: 160 }], 2);

    expect(point.x).toBeCloseTo(1180, 0);
  });

  it('centres a sprite that is larger than the screen', () => {
    expect(pickSpawnPoint({ width: 100, height: 100 }, sprite, () => 0.7)).toEqual({
      x: 50,
      y: 50,
    });
  });
});

describe('fitPointInside', () => {
  const screen = { width: 1000, height: 800 };
  const sprite = { width: 300, height: 200 };

  it('leaves a point that already fits unchanged', () => {
    expect(fitPointInside({ x: 500, y: 400 }, sprite, screen)).toEqual({ x: 500, y: 400 });
  });

  it('moves a sprite that sticks out of the left or right edge back on screen', () => {
    expect(fitPointInside({ x: 20, y: 400 }, sprite, screen).x).toBe(150);
    expect(fitPointInside({ x: 990, y: 400 }, sprite, screen).x).toBe(850);
  });

  it('keeps extra room at the top for the float-up motion', () => {
    expect(fitPointInside({ x: 500, y: 0 }, sprite, screen, 48).y).toBe(148);
    expect(fitPointInside({ x: 500, y: 800 }, sprite, screen, 48).y).toBe(700);
  });

  it('centres a sprite that cannot fit', () => {
    expect(fitPointInside({ x: 10, y: 10 }, { width: 2000, height: 2000 }, screen)).toEqual({
      x: 500,
      y: 400,
    });
  });
});

describe('pickIndex', () => {
  it.each([
    [0, 0],
    [0.5, 3],
    [0.999999, 6],
    [1, 6],
  ])('maps random %d to an index below the length', (value, expected) => {
    expect(pickIndex(7, () => value)).toBe(expected);
  });
});
