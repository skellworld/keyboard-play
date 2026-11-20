import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSpeaker,
  RESTART_DELAY_MS,
  SPEECH_MAX_VOLUME,
  type SpeechSynthLike,
  type UtteranceLike,
} from './speech';

function voice(name: string, lang: string, localService = true): SpeechSynthesisVoice {
  return { name, lang, localService, default: false, voiceURI: name } as SpeechSynthesisVoice;
}

function fakeSynth(voices: SpeechSynthesisVoice[]) {
  const listeners = new Set<() => void>();
  const synth = {
    voices,
    speaking: false,
    pending: false,
    paused: false,
    speak: vi.fn<(u: UtteranceLike) => void>(),
    cancel: vi.fn(),
    resume: vi.fn(),
    getVoices: () => synth.voices,
    addEventListener: (_type: 'voiceschanged', listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: 'voiceschanged', listener: () => void) => {
      listeners.delete(listener);
    },
  };
  const fireVoicesChanged = () => listeners.forEach((listener) => listener());
  return { synth, fireVoicesChanged, listeners };
}

function makeUtterance(text: string): UtteranceLike {
  return { text, lang: '', voice: null, rate: 1, pitch: 1, volume: 1 };
}

function speakerFor(synth: ReturnType<typeof fakeSynth>['synth']) {
  return createSpeaker(synth as SpeechSynthLike, makeUtterance);
}

describe('createSpeaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('speaks right away with a Korean voice when nothing else is speaking', () => {
    const ko = voice('Heami', 'ko-KR');
    const { synth } = fakeSynth([voice('David', 'en-US'), ko]);

    speakerFor(synth).speak('기역', 1);

    expect(synth.cancel).not.toHaveBeenCalled();
    const utterance = synth.speak.mock.calls[0]?.[0];
    expect(utterance?.text).toBe('기역');
    expect(utterance?.lang).toBe('ko-KR');
    expect(utterance?.voice).toBe(ko);
  });

  it('keeps speech a little quieter than full volume', () => {
    const { synth } = fakeSynth([voice('Heami', 'ko-KR')]);

    speakerFor(synth).speak('기역', 0.5);

    expect(synth.speak.mock.calls[0]?.[0].volume).toBeCloseTo(SPEECH_MAX_VOLUME * 0.5);
  });

  it('cuts off the current speech and starts the newest text after a short pause', () => {
    const { synth } = fakeSynth([voice('Heami', 'ko-KR')]);
    const speaker = speakerFor(synth);
    synth.speaking = true;

    speaker.speak('기역', 1);
    speaker.speak('니은', 1);

    expect(synth.cancel).toHaveBeenCalled();
    expect(synth.speak).not.toHaveBeenCalled();
    vi.advanceTimersByTime(RESTART_DELAY_MS);
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(synth.speak.mock.calls[0]?.[0].text).toBe('니은');
  });

  it('resumes a paused speech engine before speaking', () => {
    const { synth } = fakeSynth([voice('Heami', 'ko-KR')]);
    synth.paused = true;

    speakerFor(synth).speak('아', 1);

    expect(synth.resume).toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalled();
  });

  it('prefers an on-device Korean voice over an online one', () => {
    const online = voice('Google 한국의', 'ko-KR', false);
    const local = voice('Heami', 'ko_KR', true);
    const { synth } = fakeSynth([online, local]);

    speakerFor(synth).speak('아', 1);

    expect(synth.speak.mock.calls[0]?.[0].voice).toBe(local);
  });

  it('stays silent when the voice list has no Korean voice', () => {
    const { synth } = fakeSynth([voice('David', 'en-US')]);
    const speaker = speakerFor(synth);

    speaker.speak('기역', 1);

    expect(synth.speak).not.toHaveBeenCalled();
    expect(speaker.hasVoice()).toBe(false);
  });

  it('still tries Korean when the voice list is empty (Android often loads it late)', () => {
    const { synth } = fakeSynth([]);

    speakerFor(synth).speak('기역', 1);

    const utterance = synth.speak.mock.calls[0]?.[0];
    expect(utterance?.lang).toBe('ko-KR');
    expect(utterance?.voice).toBeNull();
  });

  it('picks up voices that finish loading later', () => {
    const { synth, fireVoicesChanged } = fakeSynth([]);
    const speaker = speakerFor(synth);
    expect(speaker.hasVoice()).toBe(false);

    const ko = voice('Heami', 'ko-KR');
    synth.voices = [ko];
    fireVoicesChanged();

    expect(speaker.hasVoice()).toBe(true);
    speaker.speak('일', 1);
    expect(synth.speak.mock.calls[0]?.[0].voice).toBe(ko);
  });

  it('ignores empty text or zero volume', () => {
    const { synth } = fakeSynth([voice('Heami', 'ko-KR')]);
    const speaker = speakerFor(synth);

    speaker.speak('  ', 1);
    speaker.speak('기역', 0);

    expect(synth.speak).not.toHaveBeenCalled();
  });

  it('stops speech, pending restarts and voice updates on dispose', () => {
    const { synth, listeners } = fakeSynth([voice('Heami', 'ko-KR')]);
    const speaker = speakerFor(synth);
    synth.speaking = true;
    speaker.speak('기역', 1);

    speaker.dispose();
    vi.advanceTimersByTime(RESTART_DELAY_MS);

    expect(synth.speak).not.toHaveBeenCalled();
    expect(synth.cancel).toHaveBeenCalledTimes(2);
    expect(listeners.size).toBe(0);
  });

  it('does nothing when speech is not supported', () => {
    const speaker = createSpeaker(null, makeUtterance);

    expect(() => {
      speaker.speak('기역', 1);
      speaker.dispose();
    }).not.toThrow();
    expect(speaker.hasVoice()).toBe(false);
  });

  it('does not throw when the browser refuses to speak', () => {
    const { synth } = fakeSynth([voice('Heami', 'ko-KR')]);
    synth.speak.mockImplementation(() => {
      throw new Error('not allowed');
    });

    expect(() => speakerFor(synth).speak('기역', 1)).not.toThrow();
  });
});
