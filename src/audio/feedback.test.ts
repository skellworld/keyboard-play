import { describe, expect, it, vi } from 'vitest';
import type { GlyphItem } from '../render/sprites';
import { DEFAULT_SETTINGS, type Settings } from '../settings/settingsStore';
import { createFeedback } from './feedback';

const R_AND_G: readonly GlyphItem[] = [
  { glyph: { kind: 'latin', char: 'R' }, info: { speech: '알', emoji: '🐰' } },
  { glyph: { kind: 'jamo', char: 'ㄱ' }, info: { speech: '기역', emoji: '🐻' } },
];

function setup(settings: Partial<Settings> = {}) {
  const sfx = { play: vi.fn(), unlock: vi.fn(), dispose: vi.fn() };
  const speaker = { speak: vi.fn(), stop: vi.fn(), hasVoice: () => true, dispose: vi.fn() };
  const feedback = createFeedback(sfx, speaker, () => ({ ...DEFAULT_SETTINGS, ...settings }));
  return { sfx, speaker, feedback };
}

describe('createFeedback', () => {
  it('pops and reads every glyph name for a glyph', () => {
    const { sfx, speaker, feedback } = setup({ volume: 0.4 });

    feedback.glyph(R_AND_G);

    expect(sfx.play).toHaveBeenCalledWith('pop', 0.4);
    expect(speaker.speak).toHaveBeenCalledWith('알 기역', 0.4);
  });

  it('plays a sparkle for a burst without speaking', () => {
    const { sfx, speaker, feedback } = setup();

    feedback.burst();

    expect(sfx.play).toHaveBeenCalledWith('sparkle', DEFAULT_SETTINGS.volume);
    expect(speaker.speak).not.toHaveBeenCalled();
  });

  it('respects soundOn and speechOn separately', () => {
    const muted = setup({ soundOn: false });
    muted.feedback.glyph(R_AND_G);
    muted.feedback.burst();
    expect(muted.sfx.play).not.toHaveBeenCalled();
    expect(muted.speaker.speak).toHaveBeenCalledTimes(1);

    const quiet = setup({ speechOn: false });
    quiet.feedback.glyph(R_AND_G);
    expect(quiet.sfx.play).toHaveBeenCalledTimes(1);
    expect(quiet.speaker.speak).not.toHaveBeenCalled();
  });

  it('skips glyphs without speech text', () => {
    const { speaker, feedback } = setup();

    feedback.glyph([{ glyph: { kind: 'latin', char: '?' }, info: { speech: '', emoji: '' } }]);

    expect(speaker.speak).not.toHaveBeenCalled();
  });

  it('unlocks audio only while sound is on', () => {
    const on = setup();
    on.feedback.unlock();
    expect(on.sfx.unlock).toHaveBeenCalled();

    const off = setup({ soundOn: false });
    off.feedback.unlock();
    expect(off.sfx.unlock).not.toHaveBeenCalled();
  });

  it('reports whether a Korean voice exists', () => {
    expect(setup().feedback.hasVoice()).toBe(true);
  });

  it('silences speech right away (speech turned off, page hidden)', () => {
    const { speaker, feedback } = setup();

    feedback.silence();

    expect(speaker.stop).toHaveBeenCalled();
  });

  it('disposes both the sound effects and the speaker', () => {
    const { sfx, speaker, feedback } = setup();

    feedback.dispose();

    expect(sfx.dispose).toHaveBeenCalled();
    expect(speaker.dispose).toHaveBeenCalled();
  });
});
