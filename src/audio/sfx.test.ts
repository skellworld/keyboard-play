import { describe, expect, it, vi } from 'vitest';
import { createSfx, MAX_VOICES, PEAK_GAIN } from './sfx';

interface FakeParam {
  value: number;
  setValueAtTime: ReturnType<typeof vi.fn>;
  exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
}

function fakeParam(): FakeParam {
  return {
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };
}

function fakeContext(state: AudioContextState = 'running') {
  const oscillators: Array<{
    type: string;
    frequency: FakeParam;
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];
  const gains: Array<{ gain: FakeParam; connect: ReturnType<typeof vi.fn> }> = [];
  const limiter = {
    threshold: fakeParam(),
    knee: fakeParam(),
    ratio: fakeParam(),
    attack: fakeParam(),
    release: fakeParam(),
    connect: vi.fn(),
  };
  const context = {
    state,
    currentTime: 10,
    destination: { name: 'speakers' },
    resume: vi.fn(() => Promise.resolve()),
    close: vi.fn(() => Promise.resolve()),
    createOscillator: () => {
      const osc = {
        type: 'sine',
        frequency: fakeParam(),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscillators.push(osc);
      return osc;
    },
    createGain: () => {
      const gain = { gain: fakeParam(), connect: vi.fn() };
      gains.push(gain);
      return gain;
    },
    createDynamicsCompressor: () => limiter,
  };
  return {
    context: context as unknown as AudioContext,
    raw: context,
    oscillators,
    gains,
    limiter,
  };
}

const NO_RANDOM = () => 0;

describe('createSfx playing', () => {
  it('plays a short pop with a scheduled start and stop', () => {
    const { context, oscillators } = fakeContext();
    const sfx = createSfx(() => context, NO_RANDOM);

    sfx.play('pop', 1);

    expect(oscillators).toHaveLength(1);
    expect(oscillators[0]?.start).toHaveBeenCalledWith(10);
    expect(oscillators[0]?.stop).toHaveBeenCalled();
  });

  it('plays a sparkle as a small chord of notes', () => {
    const { context, oscillators } = fakeContext();
    const sfx = createSfx(() => context, NO_RANDOM);

    sfx.play('sparkle', 1);

    expect(oscillators.length).toBeGreaterThanOrEqual(2);
  });

  it('routes every sound through a limiter so overlapping sounds cannot clip', () => {
    const { context, raw, gains, limiter } = fakeContext();
    const sfx = createSfx(() => context, NO_RANDOM);

    sfx.play('pop', 1);

    expect(gains[0]?.connect).toHaveBeenCalledWith(limiter);
    expect(limiter.connect).toHaveBeenCalledWith(raw.destination);
  });

  it('never goes above the peak gain, scaled by volume', () => {
    const { context, gains } = fakeContext();
    const sfx = createSfx(() => context, NO_RANDOM);

    sfx.play('pop', 0.5);

    const peaks = gains.flatMap((g) =>
      g.gain.linearRampToValueAtTime.mock.calls.map((call) => call[0] as number),
    );
    expect(Math.max(...peaks)).toBeCloseTo(PEAK_GAIN * 0.5);
  });

  it('stays silent when the volume is zero', () => {
    const { context, oscillators } = fakeContext();
    const sfx = createSfx(() => context, NO_RANDOM);

    sfx.play('pop', 0);

    expect(oscillators).toHaveLength(0);
  });

  it('limits sounds playing at the same time, using the audio clock rather than end events', () => {
    const { context, raw, oscillators } = fakeContext();
    const sfx = createSfx(() => context, NO_RANDOM);

    for (let k = 0; k < MAX_VOICES + 3; k += 1) {
      sfx.play('pop', 1);
    }
    expect(oscillators).toHaveLength(MAX_VOICES);

    raw.currentTime += 1; // 앞의 소리들이 모두 끝난 시각
    sfx.play('pop', 1);
    expect(oscillators).toHaveLength(MAX_VOICES + 1);
  });

  it('creates the audio context only once, lazily', () => {
    const { context } = fakeContext();
    const create = vi.fn(() => context);
    const sfx = createSfx(create, NO_RANDOM);

    expect(create).not.toHaveBeenCalled();
    sfx.play('pop', 1);
    sfx.play('pop', 1);
    expect(create).toHaveBeenCalledTimes(1);
  });
});

describe('createSfx audio state', () => {
  it('does not queue sounds while suspended (they would all burst out together on resume)', () => {
    const { context, raw, oscillators } = fakeContext('suspended');
    const sfx = createSfx(() => context, NO_RANDOM);

    sfx.play('pop', 1);

    expect(oscillators).toHaveLength(0);
    expect(raw.resume).toHaveBeenCalled();
  });

  it.each<AudioContextState>(['suspended', 'interrupted' as AudioContextState])(
    'resumes a %s context when unlocked by a user gesture',
    (state) => {
      const { context, raw } = fakeContext(state);
      const sfx = createSfx(() => context, NO_RANDOM);

      sfx.unlock();

      expect(raw.resume).toHaveBeenCalled();
    },
  );

  it('creates a new context when the old one was closed', () => {
    const closed = fakeContext('closed');
    const fresh = fakeContext('running');
    const create = vi.fn().mockReturnValueOnce(closed.context).mockReturnValueOnce(fresh.context);
    const sfx = createSfx(create, NO_RANDOM);

    sfx.unlock();
    sfx.play('pop', 1);

    expect(create).toHaveBeenCalledTimes(2);
    expect(fresh.oscillators).toHaveLength(1);
  });

  it('closes the context on dispose', () => {
    const { context, raw } = fakeContext();
    const sfx = createSfx(() => context, NO_RANDOM);
    sfx.play('pop', 1);

    sfx.dispose();

    expect(raw.close).toHaveBeenCalled();
  });

  it('does nothing when audio is not available', () => {
    const sfx = createSfx(() => null, NO_RANDOM);

    expect(() => {
      sfx.unlock();
      sfx.play('pop', 1);
      sfx.dispose();
    }).not.toThrow();
  });

  it('does not throw when creating the audio context fails', () => {
    const sfx = createSfx(() => {
      throw new Error('no audio device');
    }, NO_RANDOM);

    expect(() => sfx.play('sparkle', 1)).not.toThrow();
  });
});
