import type { GlyphInfo } from '../content/glyphs';
import type { Glyph } from '../input/keymap';
import { pickIndex } from './layout';

export interface GlyphItem {
  readonly glyph: Glyph;
  readonly info: GlyphInfo;
}

/** play.css의 --sprite-c0 ~ --sprite-c6 */
export const SPRITE_COLOR_COUNT = 7;
export const BURST_PARTICLE_COUNT = 6;
/** 이모지가 이보다 많으면(숫자 4~9의 병아리) 작게 여러 줄로 보여 준다 */
const MANY_EMOJI_THRESHOLD = 3;

const BURST_SYMBOLS: readonly string[] = ['⭐', '💖', '✨', '💛', '💚', '💙', '🌟'];
const BURST_ANGLE_JITTER_DEG = 30;
const BURST_MIN_DISTANCE_PX = 60;
const BURST_DISTANCE_RANGE_PX = 50;

function element(tag: string, className: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/** 글자(들)와 그림을 담은 스프라이트. 모든 문자열은 textContent로 넣어 HTML로 해석되지 않는다. */
export function createGlyphSprite(items: readonly GlyphItem[], colorIndex: number): HTMLElement {
  const sprite = element('div', `sprite sprite--glyph sprite--c${colorIndex}`);
  sprite.setAttribute('aria-hidden', 'true');
  const body = element('div', 'sprite__body');

  const glyphRow = element('div', 'sprite__glyphs');
  glyphRow.append(
    ...items.map(({ glyph }) => {
      const char = element('span', `sprite__char sprite__char--${glyph.kind}`);
      char.textContent = glyph.char;
      return char;
    }),
  );
  body.append(glyphRow);

  const emojis = items.map(({ info }) => info.emoji).filter((emoji) => emoji !== '');
  if (emojis.length > 0) {
    const text = emojis.join(' ');
    const many = countSymbols(text) > MANY_EMOJI_THRESHOLD;
    const emojiRow = element('div', many ? 'sprite__emoji sprite__emoji--many' : 'sprite__emoji');
    emojiRow.textContent = text;
    body.append(emojiRow);
  }

  sprite.append(body);
  return sprite;
}

/** 공백과 이모지 변형 선택자(U+FE0F)를 빼고 센 기호 수 */
function countSymbols(text: string): number {
  return Array.from(text.replace(/[\s️]/g, '')).length;
}

/** 별·하트가 사방으로 퍼지는 효과 */
export function createBurstSprite(random: () => number): HTMLElement {
  const sprite = element('div', 'sprite sprite--burst');
  sprite.setAttribute('aria-hidden', 'true');
  const step = 360 / BURST_PARTICLE_COUNT;

  for (let k = 0; k < BURST_PARTICLE_COUNT; k += 1) {
    const particle = element('span', 'burst__particle');
    particle.textContent = BURST_SYMBOLS[pickIndex(BURST_SYMBOLS.length, random)] ?? '⭐';
    const angle = k * step + (random() - 0.5) * BURST_ANGLE_JITTER_DEG;
    const distance = BURST_MIN_DISTANCE_PX + random() * BURST_DISTANCE_RANGE_PX;
    particle.style.setProperty('--angle', `${angle.toFixed(1)}deg`);
    particle.style.setProperty('--distance', `${distance.toFixed(0)}px`);
    sprite.append(particle);
  }
  return sprite;
}
