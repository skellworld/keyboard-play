import type { Point } from '../input/holdDetector';
import {
  fitPointInside,
  glyphFontSize,
  glyphSpriteSize,
  pickIndex,
  pickSpawnPoint,
  type Size,
} from './layout';
import {
  createBurstSprite,
  createGlyphSprite,
  SPRITE_COLOR_COUNT,
  type GlyphItem,
} from './sprites';

export const MAX_SPRITES = 30;
/** CSS 애니메이션(3000ms)이 확실히 끝난 뒤 지우도록 약간 여유를 둔다 */
export const GLYPH_LIFETIME_MS = 3100;
export const BURST_LIFETIME_MS = 1000;
/** 상한을 넘어 밀려나는 스프라이트가 사라지는 시간 (play.css --duration-leave와 맞춤) */
export const SPRITE_LEAVE_MS = 250;
const BURST_BOX: Size = { width: 240, height: 240 };
/** 글자가 떠오르는 높이 (play.css sprite-life의 -6vh) */
const FLOAT_RATIO = 0.06;

export interface StageOptions {
  readonly maxSprites?: number;
  readonly lifetimeMs?: number;
  readonly burstLifetimeMs?: number;
  readonly leaveMs?: number;
  readonly random?: () => number;
  readonly viewport?: () => Size;
}

export interface Stage {
  readonly element: HTMLElement;
  spawnGlyph(items: readonly GlyphItem[]): void;
  spawnBurst(at?: Point): void;
  activeCount(): number;
  destroy(): void;
}

interface ActiveSprite {
  readonly element: HTMLElement;
  readonly center: Point;
  readonly timer: ReturnType<typeof setTimeout>;
}

function windowViewport(): Size {
  return { width: window.innerWidth, height: window.innerHeight };
}

/** 화면 전체를 덮는 놀이판. 스프라이트를 붙이고, 수명이 다하면 떼고, 동시 개수를 제한한다. */
export function createStage(options: StageOptions = {}): Stage {
  const maxSprites = options.maxSprites ?? MAX_SPRITES;
  const lifetimeMs = options.lifetimeMs ?? GLYPH_LIFETIME_MS;
  const burstLifetimeMs = options.burstLifetimeMs ?? BURST_LIFETIME_MS;
  const leaveMs = options.leaveMs ?? SPRITE_LEAVE_MS;
  const random = options.random ?? Math.random;
  const viewport = options.viewport ?? windowViewport;

  const element = document.createElement('div');
  element.className = 'stage';
  let active: readonly ActiveSprite[] = [];
  const leavingTimers = new Set<ReturnType<typeof setTimeout>>();

  function occupiedCenters(): readonly Point[] {
    return active.map((record) => record.center);
  }

  function remove(record: ActiveSprite): void {
    active = active.filter((r) => r !== record);
    record.element.remove();
  }

  function sendAway(record: ActiveSprite): void {
    clearTimeout(record.timer);
    active = active.filter((r) => r !== record);
    record.element.classList.add('sprite--leaving');
    const timer = setTimeout(() => {
      leavingTimers.delete(timer);
      record.element.remove();
    }, leaveMs);
    leavingTimers.add(timer);
  }

  /** 붙인 뒤 실제 크기를 재서 화면 안으로 옮긴다 (크기를 못 재는 환경에서는 그대로). */
  function fitMeasured(sprite: HTMLElement, point: Point): Point {
    const size = { width: sprite.offsetWidth, height: sprite.offsetHeight };
    if (size.width === 0 || size.height === 0) {
      return point;
    }
    const screen = viewport();
    return fitPointInside(point, size, screen, screen.height * FLOAT_RATIO);
  }

  function add(sprite: HTMLElement, point: Point, lifetime: number, fit: boolean): void {
    element.append(sprite);
    const center = fit ? fitMeasured(sprite, point) : point;
    sprite.style.left = `${Math.round(center.x)}px`;
    sprite.style.top = `${Math.round(center.y)}px`;
    const record: ActiveSprite = {
      element: sprite,
      center,
      timer: setTimeout(() => remove(record), lifetime),
    };
    active = [...active, record];
    while (active.length > maxSprites && active[0]) {
      sendAway(active[0]);
    }
  }

  return {
    element,
    spawnGlyph(items) {
      const screen = viewport();
      const fontSize = glyphFontSize(screen, items.length);
      const sprite = createGlyphSprite(items, pickIndex(SPRITE_COLOR_COUNT, random));
      sprite.style.setProperty('--glyph-size', `${Math.round(fontSize)}px`);
      const size = glyphSpriteSize(fontSize, items.length);
      add(sprite, pickSpawnPoint(screen, size, random, occupiedCenters()), lifetimeMs, true);
    },
    spawnBurst(at) {
      const point = at ?? pickSpawnPoint(viewport(), BURST_BOX, random, occupiedCenters());
      // 터치한 자리의 효과는 손가락 위치 그대로 둔다.
      add(createBurstSprite(random), point, burstLifetimeMs, false);
    },
    activeCount() {
      return active.length;
    },
    destroy() {
      active.forEach((record) => clearTimeout(record.timer));
      leavingTimers.forEach((timer) => clearTimeout(timer));
      leavingTimers.clear();
      active = [];
      element.replaceChildren();
    },
  };
}
