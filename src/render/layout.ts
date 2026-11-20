import type { Point } from '../input/holdDetector';

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * 글자 크기: 화면 높이의 28% (글자 자체 높이 약 0.7em이 화면의 20% 이상이 되도록).
 * 세로 화면에서는 글자 줄 전체 너비가 화면 너비의 45%를 넘지 않게 줄인다.
 */
const GLYPH_HEIGHT_RATIO = 0.28;
const GLYPH_WIDTH_RATIO = 0.5;
/** 글자 하나의 대략적인 너비와 글자 사이 간격 (em) */
const GLYPH_WIDTH_EM = 0.9;
const GLYPH_GAP_EM = 0.15;
/** 글자 줄 + 이모지 줄 + 떠오르는 움직임까지 포함한 대략적인 높이 (em) */
const SPRITE_HEIGHT_EM = 1.8;
/** 이미 떠 있는 글자와 덜 겹치도록 뽑아 보는 후보 수 */
const SPAWN_ATTEMPTS = 6;

export function glyphFontSize(viewport: Size, glyphCount: number = 1): number {
  const widthLimit = (viewport.width * GLYPH_WIDTH_RATIO * GLYPH_WIDTH_EM) / rowWidthEm(glyphCount);
  return Math.min(viewport.height * GLYPH_HEIGHT_RATIO, widthLimit);
}

export function glyphSpriteSize(fontSize: number, glyphCount: number): Size {
  return {
    width: fontSize * rowWidthEm(glyphCount),
    height: fontSize * SPRITE_HEIGHT_EM,
  };
}

/** 글자 n개가 나란히 놓인 줄의 너비 (em) */
function rowWidthEm(glyphCount: number): number {
  const count = Math.max(1, glyphCount);
  return GLYPH_WIDTH_EM * count + GLYPH_GAP_EM * (count - 1);
}

/**
 * 스프라이트 전체가 화면 안에 들어오는 임의의 중심점.
 * 이미 떠 있는 스프라이트(occupied)가 있으면 후보 몇 개 중 가장 멀리 떨어진 곳을 고른다.
 */
export function pickSpawnPoint(
  viewport: Size,
  sprite: Size,
  random: () => number,
  occupied: readonly Point[] = [],
  attempts: number = SPAWN_ATTEMPTS,
): Point {
  const candidate = (): Point => ({
    x: axisPosition(viewport.width, sprite.width, random()),
    y: axisPosition(viewport.height, sprite.height, random()),
  });
  if (occupied.length === 0) {
    return candidate();
  }
  const candidates = Array.from({ length: Math.max(1, attempts) }, candidate);
  return candidates.reduce((best, next) =>
    nearestDistance(next, occupied) > nearestDistance(best, occupied) ? next : best,
  );
}

function nearestDistance(point: Point, others: readonly Point[]): number {
  return Math.min(...others.map((o) => Math.hypot(point.x - o.x, point.y - o.y)));
}

/**
 * 실제 크기를 잰 스프라이트가 화면 밖으로 나가지 않게 중심점을 옮긴다.
 * topMargin: 위로 떠오르는 움직임(play.css sprite-life)만큼 위쪽에 남길 여유.
 */
export function fitPointInside(
  point: Point,
  sprite: Size,
  viewport: Size,
  topMargin: number = 0,
): Point {
  return {
    x: axisFit(point.x, sprite.width, viewport.width, 0),
    y: axisFit(point.y, sprite.height, viewport.height, topMargin),
  };
}

function axisFit(value: number, size: number, length: number, startMargin: number): number {
  if (size + startMargin > length) {
    return length / 2;
  }
  return Math.min(length - size / 2, Math.max(startMargin + size / 2, value));
}

function axisPosition(length: number, size: number, r: number): number {
  if (size >= length) {
    return length / 2;
  }
  return size / 2 + r * (length - size);
}

/** 0 이상 length 미만의 정수 (random()이 1을 돌려줘도 안전) */
export function pickIndex(length: number, random: () => number): number {
  return Math.min(length - 1, Math.floor(random() * length));
}
