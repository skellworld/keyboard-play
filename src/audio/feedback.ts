import type { GlyphItem } from '../render/sprites';
import type { Settings } from '../settings/settingsStore';
import type { Sfx } from './sfx';
import type { Speaker } from './speech';

/** 화면 반응에 맞춰 효과음·읽어주기를 내는 창구. 설정(soundOn, speechOn, volume)을 여기서 적용한다. */
export interface Feedback {
  glyph(items: readonly GlyphItem[]): void;
  burst(): void;
  unlock(): void;
  dispose(): void;
}

export function createFeedback(
  sfx: Sfx,
  speaker: Pick<Speaker, 'speak' | 'dispose'>,
  getSettings: () => Settings,
): Feedback {
  return {
    glyph(items) {
      const settings = getSettings();
      if (settings.soundOn) {
        sfx.play('pop', settings.volume);
      }
      const text = items
        .map(({ info }) => info.speech)
        .filter((speech) => speech !== '')
        .join(' ');
      if (settings.speechOn && text !== '') {
        speaker.speak(text, settings.volume);
      }
    },
    burst() {
      const settings = getSettings();
      if (settings.soundOn) {
        sfx.play('sparkle', settings.volume);
      }
    },
    unlock() {
      // 소리를 끈 상태에서는 오디오 장치를 붙잡지 않는다.
      if (getSettings().soundOn) {
        sfx.unlock();
      }
    },
    dispose() {
      sfx.dispose();
      speaker.dispose();
    },
  };
}
