import { describe, expect, it, vi } from 'vitest';
import type { Speaker } from './speech';
import { allSpeechTexts } from '../content/glyphs';
import {
  CLIP_GAIN,
  createClipPlayer,
  createClipSpeaker,
  RESUME_TIMEOUT_MS,
  voiceClipFile,
} from './voiceClips';

describe('bundled MeloTTS clips (public/voice)', () => {
  const bundled = Object.keys(import.meta.glob('/public/voice/*.ogg')).map(
    (path) => path.split('/').pop() ?? '',
  );

  it('has a clip for every spoken name and no leftovers', () => {
    const expected = allSpeechTexts().map(voiceClipFile);

    expect([...bundled].sort()).toEqual([...expected].sort());
  });
});

describe('voiceClipFile', () => {
  it.each([
    ['기역', 'ae30-c5ed.ogg'],
    ['아', 'c544.ogg'],
    ['에이', 'c5d0-c774.ogg'],
    ['일', 'c77c.ogg'],
  ])('names the clip for %j as %s', (text, file) => {
    expect(voiceClipFile(text)).toBe(file);
  });

  it('gives different texts different files', () => {
    expect(voiceClipFile('이')).not.toBe(voiceClipFile('일'));
  });
});

function fakeAudio(state: AudioContextState = 'running') {
  const sources: Array<{
    buffer: { duration: number } | null;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
  }> = [];
  const gains: Array<{ gain: { value: number }; connect: ReturnType<typeof vi.fn> }> = [];
  const context = {
    state,
    currentTime: 2,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    decodeAudioData: vi.fn(async (data: ArrayBuffer) => ({ duration: data.byteLength / 10 })),
    createBufferSource: () => {
      const source = { buffer: null, start: vi.fn(), stop: vi.fn(), connect: vi.fn() };
      sources.push(source);
      return source;
    },
    createGain: () => {
      const gain = { gain: { value: 1 }, connect: vi.fn() };
      gains.push(gain);
      return gain;
    },
  };
  return { context: context as unknown as AudioContext, raw: context, sources, gains };
}

function setup(options: { state?: AudioContextState; missing?: string[] } = {}) {
  const audio = fakeAudio(options.state);
  const fetchClip = vi.fn(async (url: string) => {
    if (options.missing?.some((file) => url.endsWith(file))) {
      throw new Error('404');
    }
    return new ArrayBuffer(5); // 길이 0.5초짜리 가짜 음성
  });
  const player = createClipPlayer({
    baseUrl: '/app/voice/',
    createContext: () => audio.context,
    fetchClip,
  });
  return { ...audio, fetchClip, player };
}

describe('createClipPlayer', () => {
  it('plays the clip of each text one after another', async () => {
    const { player, sources, fetchClip } = setup();

    await expect(player.play(['알', '기역'], 1)).resolves.toBe(true);

    expect(fetchClip).toHaveBeenCalledWith(`/app/voice/${voiceClipFile('알')}`);
    expect(fetchClip).toHaveBeenCalledWith(`/app/voice/${voiceClipFile('기역')}`);
    const [first, second] = sources.map((s) => s.start.mock.calls[0]?.[0] as number);
    expect(first).toBeGreaterThanOrEqual(2);
    expect(second).toBeGreaterThan((first ?? 0) + 0.5);
  });

  it('downloads and decodes each clip only once', async () => {
    const { player, fetchClip } = setup();

    await player.play(['기역'], 1);
    await player.play(['기역'], 1);

    expect(fetchClip).toHaveBeenCalledTimes(1);
  });

  it('plays at the volume setting, kept a little below full', async () => {
    const { player, gains } = setup();

    await player.play(['아'], 0.5);

    expect(gains[0]?.gain.value).toBeCloseTo(CLIP_GAIN * 0.5);
  });

  it('cuts off the current clip when a newer one starts', async () => {
    const { player, sources } = setup();
    await player.play(['기역'], 1);

    await player.play(['니은'], 1);

    expect(sources[0]?.stop).toHaveBeenCalled();
  });

  it('drops an older request that finishes loading after a newer one', async () => {
    const { player } = setup();

    const older = player.play(['기역'], 1);
    const newer = player.play(['니은'], 1);

    await expect(older).resolves.toBe(false);
    await expect(newer).resolves.toBe(true);
  });

  it('reports failure for a missing clip and tries again next time', async () => {
    const { player, fetchClip } = setup({ missing: [voiceClipFile('아')] });

    await expect(player.play(['아'], 1)).resolves.toBe(false);
    await player.play(['아'], 1);

    expect(fetchClip).toHaveBeenCalledTimes(2);
  });

  it('wakes a suspended audio context (user gesture) and skips this clip', async () => {
    const { player, raw, sources } = setup({ state: 'suspended' });

    await expect(player.play(['아'], 1)).resolves.toBe(false);

    expect(raw.resume).toHaveBeenCalled();
    expect(sources).toHaveLength(0);
  });

  it('gives up quickly when waking the audio hangs, so the device voice can take over', async () => {
    vi.useFakeTimers();
    const { player, raw } = setup({ state: 'suspended' });
    raw.resume.mockImplementation(() => new Promise(() => undefined));

    const result = player.play(['아'], 1);
    await vi.advanceTimersByTimeAsync(RESUME_TIMEOUT_MS);

    await expect(result).resolves.toBe(false);
    vi.useRealTimers();
  });

  it('stops already started words if a later word fails to start (no double speech)', async () => {
    const { player, sources, raw } = setup();
    const create = raw.createBufferSource;
    let made = 0;
    raw.createBufferSource = () => {
      const source = create();
      made += 1;
      if (made === 2) {
        source.start.mockImplementation(() => {
          throw new Error('cannot start');
        });
      }
      return source;
    };

    await expect(player.play(['알', '기역'], 1)).resolves.toBe(false);

    expect(sources[0]?.stop).toHaveBeenCalled();
  });

  it('stays silent after dispose', async () => {
    const { player, fetchClip } = setup();
    player.dispose();

    await expect(player.play(['아'], 1)).resolves.toBe(false);
    expect(fetchClip).not.toHaveBeenCalled();
  });

  it('stays silent at volume zero', async () => {
    const { player, fetchClip } = setup();

    await expect(player.play(['아'], 0)).resolves.toBe(true);

    expect(fetchClip).not.toHaveBeenCalled();
  });

  it('reports failure without audio support', async () => {
    const player = createClipPlayer({ baseUrl: '/', createContext: () => null });

    await expect(player.play(['아'], 1)).resolves.toBe(false);
  });

  it('stops and closes the audio context on dispose', async () => {
    const { player, raw, sources } = setup();
    await player.play(['아'], 1);

    player.dispose();

    expect(sources[0]?.stop).toHaveBeenCalled();
    expect(raw.close).toHaveBeenCalled();
  });
});

function fakeSpeaker() {
  return {
    speak: vi.fn<Speaker['speak']>(),
    stop: vi.fn<Speaker['stop']>(),
    dispose: vi.fn<Speaker['dispose']>(),
    hasVoice: () => false,
  };
}

function fakePlayer(results: boolean[]) {
  return {
    play: vi.fn(async () => results.shift() ?? true),
    stop: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('createClipSpeaker', () => {
  it('speaks with the MeloTTS clips, one per word', async () => {
    const player = fakePlayer([true]);
    const fallback = fakeSpeaker();
    const speaker = createClipSpeaker(player, fallback);

    speaker.speak('알 기역', 0.6);
    await Promise.resolve();

    expect(player.play).toHaveBeenCalledWith(['알', '기역'], 0.6);
    expect(fallback.speak).not.toHaveBeenCalled();
  });

  it('falls back to the device voice when a clip cannot play', async () => {
    const fallback = fakeSpeaker();
    const speaker = createClipSpeaker(fakePlayer([false]), fallback);

    speaker.speak('기역', 1);
    await vi.waitFor(() => expect(fallback.speak).toHaveBeenCalledWith('기역', 1));
  });

  it('does not fall back for a request that a newer one replaced', async () => {
    const fallback = fakeSpeaker();
    const speaker = createClipSpeaker(fakePlayer([false, true]), fallback);

    speaker.speak('기역', 1);
    speaker.speak('니은', 1);
    await Promise.resolve();
    await Promise.resolve();

    expect(fallback.speak).not.toHaveBeenCalled();
  });

  it('always has a voice (the clips ship with the app)', () => {
    expect(createClipSpeaker(fakePlayer([]), fakeSpeaker()).hasVoice()).toBe(true);
  });

  it('stops and disposes both the clips and the device voice', () => {
    const player = fakePlayer([]);
    const fallback = fakeSpeaker();
    const speaker = createClipSpeaker(player, fallback);

    speaker.stop();
    speaker.dispose();

    expect(player.stop).toHaveBeenCalled();
    expect(fallback.stop).toHaveBeenCalled();
    expect(player.dispose).toHaveBeenCalled();
    expect(fallback.dispose).toHaveBeenCalled();
  });
});
