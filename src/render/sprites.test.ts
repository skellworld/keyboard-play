import { describe, expect, it } from 'vitest';
import { BURST_PARTICLE_COUNT, createBurstSprite, createGlyphSprite } from './sprites';

describe('createGlyphSprite', () => {
  it('shows the glyph, its emoji and a colour class', () => {
    const sprite = createGlyphSprite(
      [{ glyph: { kind: 'jamo', char: 'ㄱ' }, info: { speech: '기역', emoji: '🐻' } }],
      3,
    );

    expect(sprite.classList).toContain('sprite');
    expect(sprite.classList).toContain('sprite--c3');
    expect(sprite.querySelector('.sprite__char--jamo')?.textContent).toBe('ㄱ');
    expect(sprite.querySelector('.sprite__emoji')?.textContent).toBe('🐻');
    expect(sprite.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows every glyph and emoji when a key produces two glyphs', () => {
    const sprite = createGlyphSprite(
      [
        { glyph: { kind: 'latin', char: 'R' }, info: { speech: '알', emoji: '🐰' } },
        { glyph: { kind: 'jamo', char: 'ㄱ' }, info: { speech: '기역', emoji: '🐻' } },
      ],
      0,
    );

    const chars = [...sprite.querySelectorAll('.sprite__char')].map((el) => el.textContent);
    expect(chars).toEqual(['R', 'ㄱ']);
    expect(sprite.querySelector('.sprite__emoji')?.textContent).toBe('🐰 🐻');
  });

  it('marks a row of many emoji so it can wrap into smaller rows', () => {
    const many = createGlyphSprite(
      [{ glyph: { kind: 'digit', char: '7' }, info: { speech: '칠', emoji: '🐥'.repeat(7) } }],
      0,
    );
    const few = createGlyphSprite(
      [{ glyph: { kind: 'digit', char: '3' }, info: { speech: '삼', emoji: '🐥'.repeat(3) } }],
      0,
    );

    expect(many.querySelector('.sprite__emoji')?.classList).toContain('sprite__emoji--many');
    expect(few.querySelector('.sprite__emoji')?.classList).not.toContain('sprite__emoji--many');
  });

  it('omits the emoji row when there is no emoji', () => {
    const sprite = createGlyphSprite(
      [{ glyph: { kind: 'latin', char: '?' }, info: { speech: '', emoji: '' } }],
      0,
    );

    expect(sprite.querySelector('.sprite__emoji')).toBeNull();
  });

  it('renders text safely without interpreting HTML', () => {
    const sprite = createGlyphSprite(
      [{ glyph: { kind: 'latin', char: '<b>x</b>' }, info: { speech: '', emoji: '<i>' } }],
      0,
    );

    expect(sprite.querySelector('b')).toBeNull();
    expect(sprite.querySelector('.sprite__char')?.textContent).toBe('<b>x</b>');
  });
});

describe('createBurstSprite', () => {
  it('creates a burst of particles spread around a circle', () => {
    const sprite = createBurstSprite(() => 0.5);
    const particles = [...sprite.querySelectorAll<HTMLElement>('.burst__particle')];

    expect(sprite.classList).toContain('sprite--burst');
    expect(particles).toHaveLength(BURST_PARTICLE_COUNT);
    const angles = particles.map((p) => Number.parseFloat(p.style.getPropertyValue('--angle')));
    expect(new Set(angles).size).toBe(BURST_PARTICLE_COUNT);
  });
});
