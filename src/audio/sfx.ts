/**
 * 효과음: 음원 파일 없이 Web Audio로 짧은 소리를 합성한다 (용량 0, 라이선스 문제 없음).
 * - pop: 글자가 나올 때. 5음 음계에서 무작위로 골라 마구 눌러도 듣기 좋게.
 * - sparkle: 별·하트 효과. 높은 두 음.
 * 아이 귀 보호: 최대 음량을 낮게 묶고, 모든 소리를 리미터에 통과시켜 겹쳐도 커지지 않게 한다.
 */

export type SoundName = 'pop' | 'sparkle';

export interface Sfx {
  /** 사용자 동작(키·터치) 안에서 불러 오디오 재생을 허용받는다. */
  unlock(): void;
  /** volume: 0 ~ 1 (설정값) */
  play(name: SoundName, volume: number): void;
  /** 오디오 장치를 놓아준다. */
  dispose(): void;
}

/** 소리 하나의 최대 음량 (volume 1일 때) */
export const PEAK_GAIN = 0.25;
/** 동시에 울리는 소리 수 상한 */
export const MAX_VOICES = 6;

/** C5 D5 E5 G5 A5 C6 (5음 음계) */
const PENTATONIC_HZ: readonly number[] = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
/** E6, B6 */
const SPARKLE_HZ: readonly number[] = [1318.51, 1975.53];
const SPARKLE_STEP_S = 0.06;
const SPARKLE_LEVEL = 0.6;
const SILENT = 0.0001;
const STOP_PADDING_S = 0.02;
/** 겹친 소리의 합이 일정 크기를 넘지 않게 누르는 리미터 설정 */
const LIMITER = { threshold: -12, knee: 6, ratio: 12, attack: 0.003, release: 0.15 } as const;

interface ToneSpec {
  readonly type: OscillatorType;
  readonly frequency: number;
  readonly glideTo?: number;
  readonly start: number;
  readonly attack: number;
  readonly duration: number;
  readonly peak: number;
}

type AudioContextConstructor = new () => AudioContext;

function defaultContext(): AudioContext | null {
  const scope = window as Window & { webkitAudioContext?: AudioContextConstructor };
  const Ctor: AudioContextConstructor | undefined = window.AudioContext ?? scope.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

function createLimiter(ctx: AudioContext): AudioNode {
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = LIMITER.threshold;
  limiter.knee.value = LIMITER.knee;
  limiter.ratio.value = LIMITER.ratio;
  limiter.attack.value = LIMITER.attack;
  limiter.release.value = LIMITER.release;
  limiter.connect(ctx.destination);
  return limiter;
}

/** suspended·interrupted 상태를 다시 깨운다 (closed는 새로 만들어야 함). */
function wake(ctx: AudioContext): void {
  if (ctx.state !== 'running' && ctx.state !== 'closed') {
    void ctx.resume().catch(() => undefined);
  }
}

export function createSfx(
  createContext: () => AudioContext | null = defaultContext,
  random: () => number = Math.random,
): Sfx {
  /** undefined: 아직 만들지 않음, null: 사용할 수 없음 */
  let context: AudioContext | null | undefined;
  let output: AudioNode | null = null;
  /** 울리고 있는 소리들의 끝나는 시각 (onended에 기대지 않고 오디오 시계로 센다) */
  let voiceEnds: readonly number[] = [];

  function reset(): void {
    context = undefined;
    output = null;
    voiceEnds = [];
  }

  function getContext(): AudioContext | null {
    if (context?.state === 'closed') {
      reset();
    }
    if (context === undefined) {
      try {
        context = createContext();
        output = context ? createLimiter(context) : null;
      } catch {
        context = null;
        output = null;
      }
    }
    return context;
  }

  function tone(ctx: AudioContext, destination: AudioNode, spec: ToneSpec): void {
    voiceEnds = voiceEnds.filter((end) => end > ctx.currentTime);
    if (voiceEnds.length >= MAX_VOICES) {
      return;
    }
    const end = spec.start + spec.duration + STOP_PADDING_S;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.frequency, spec.start);
    if (spec.glideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(spec.glideTo, spec.start + spec.duration * 0.4);
    }
    gain.gain.setValueAtTime(SILENT, spec.start);
    gain.gain.linearRampToValueAtTime(spec.peak, spec.start + spec.attack);
    gain.gain.exponentialRampToValueAtTime(SILENT, spec.start + spec.duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(spec.start);
    osc.stop(end);
    voiceEnds = [...voiceEnds, end];
  }

  function playPop(ctx: AudioContext, destination: AudioNode, peak: number): void {
    const frequency = PENTATONIC_HZ[Math.floor(random() * PENTATONIC_HZ.length)] ?? 659.25;
    tone(ctx, destination, {
      type: 'sine',
      frequency,
      glideTo: frequency * 1.5,
      start: ctx.currentTime,
      attack: 0.005,
      duration: 0.18,
      peak,
    });
  }

  function playSparkle(ctx: AudioContext, destination: AudioNode, peak: number): void {
    SPARKLE_HZ.forEach((frequency, k) => {
      tone(ctx, destination, {
        type: 'triangle',
        frequency,
        start: ctx.currentTime + k * SPARKLE_STEP_S,
        attack: 0.01,
        duration: 0.35,
        peak: peak * SPARKLE_LEVEL,
      });
    });
  }

  return {
    unlock() {
      const ctx = getContext();
      if (ctx) {
        wake(ctx);
      }
    },
    play(name, volume) {
      if (!(volume > 0)) {
        return;
      }
      const ctx = getContext();
      if (!ctx || !output) {
        return;
      }
      // 멈춘 상태에서 예약하면 깨어날 때 한꺼번에 터져 나오므로, 깨우기만 하고 이번 소리는 건너뛴다.
      if (ctx.state !== 'running') {
        wake(ctx);
        return;
      }
      const peak = PEAK_GAIN * Math.min(1, volume);
      try {
        if (name === 'pop') {
          playPop(ctx, output, peak);
        } else {
          playSparkle(ctx, output, peak);
        }
      } catch {
        // 소리 재생 실패(장치 문제 등)는 놀이를 막지 않는다.
      }
    },
    dispose() {
      if (context && context.state !== 'closed') {
        void context.close().catch(() => undefined);
      }
      reset();
    },
  };
}
