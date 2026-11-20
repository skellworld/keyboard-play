import { getGlyphInfo } from '../content/glyphs';
import { isInExitCorner, type Point, type Viewport } from '../input/holdDetector';
import {
  acceptInput,
  INITIAL_RATE_LIMIT,
  type InputLike,
  type RateLimitState,
} from '../input/inputFilter';
import { mapKey, type KeyPress } from '../input/keymap';
import type { Stage } from '../render/stage';
import type { Settings } from '../settings/settingsStore';

export interface KeyInput extends KeyPress {
  readonly repeat: boolean;
}

export interface PlayControllerDeps {
  readonly stage: Pick<Stage, 'spawnGlyph' | 'spawnBurst'>;
  readonly getSettings: () => Settings;
  /** performance.now()와 같은 시계 */
  readonly now: () => number;
  readonly viewport: () => Viewport;
}

export interface PlayController {
  handleKeyDown(input: KeyInput): void;
  handlePointerDown(point: Point): void;
}

/**
 * 놀이 입력 → 화면 반응.
 * 처리 순서(02-plan.md 통합 규칙): mapKey로 먼저 거른 뒤, 화면에 반응할 입력만 초당 상한을 쓴다.
 * 키보드와 터치는 같은 상한을 공유한다.
 */
export function createPlayController(deps: PlayControllerDeps): PlayController {
  let rateLimit: RateLimitState = INITIAL_RATE_LIMIT;

  function consume(input: InputLike): boolean {
    const decision = acceptInput(rateLimit, input, deps.now());
    rateLimit = decision.state;
    return decision.accepted;
  }

  return {
    handleKeyDown(input) {
      const output = mapKey(input, deps.getSettings());
      if (output.type === 'ignore' || !consume(input)) {
        return;
      }
      if (output.type === 'glyphs') {
        deps.stage.spawnGlyph(output.glyphs.map((glyph) => ({ glyph, info: getGlyphInfo(glyph) })));
      } else {
        deps.stage.spawnBurst();
      }
    },
    handlePointerDown(point) {
      if (!deps.getSettings().touchOn || isInExitCorner(point, deps.viewport())) {
        return;
      }
      if (consume({ repeat: false })) {
        deps.stage.spawnBurst(point);
      }
    },
  };
}
