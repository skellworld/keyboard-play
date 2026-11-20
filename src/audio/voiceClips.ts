/**
 * MeloTTS로 미리 만든 글자 이름 음성 파일 (public/voice/*.ogg) 재생.
 * - 기기마다 같은 목소리, 인터넷·기기 음성 없이도 동작 (파일은 오프라인 저장 대상).
 * - 새 글자가 오면 지금 소리를 끊고 가장 최근 것만 재생한다 (FR-08a).
 * - 파일을 못 쓰면 기기 내장 음성으로 대신 읽는다 (createClipSpeaker).
 */
import type { Speaker } from './speech';

/** 음성 파일은 최대 음량(-3dBFS)으로 맞춰 두었으므로, 효과음보다 튀지 않게 조금 줄여서 낸다. */
export const CLIP_GAIN = 0.5;
const START_DELAY_S = 0.01;
/** "알 기역"처럼 두 낱말을 이어 읽을 때 사이의 쉼 */
const GAP_BETWEEN_CLIPS_S = 0.08;

/**
 * 파일 이름은 문장의 유니코드 코드값으로 정한다: '기역' → 'ae30-c5ed.ogg'.
 * 만드는 쪽(tools/tts/generate_voice.py)은 scripts/export-speech-texts.mjs가 이 함수로 만든 이름을 그대로 쓴다.
 */
export function voiceClipFile(text: string): string {
  const codes = Array.from(text).map((char) => (char.codePointAt(0) ?? 0).toString(16));
  return `${codes.join('-')}.ogg`;
}

export interface ClipPlayer {
  /** 재생했거나(소리 꺼짐 포함) 할 일이 없으면 true, 파일·오디오 문제로 못 하면 false */
  play(texts: readonly string[], volume: number): Promise<boolean>;
  stop(): void;
  dispose(): void;
}

export interface ClipPlayerOptions {
  /** 음성 파일 폴더 주소 (끝에 / 포함) */
  readonly baseUrl: string;
  readonly createContext?: () => AudioContext | null;
  readonly fetchClip?: (url: string) => Promise<ArrayBuffer>;
}

type AudioContextConstructor = new () => AudioContext;

function defaultContext(): AudioContext | null {
  const scope = window as Window & { webkitAudioContext?: AudioContextConstructor };
  const Ctor: AudioContextConstructor | undefined = window.AudioContext ?? scope.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

async function defaultFetch(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${url}`);
  }
  return response.arrayBuffer();
}

/** 오디오 깨우기가 끝나지 않을 때 기다리는 최대 시간 (넘으면 기기 음성으로 대신 읽는다) */
export const RESUME_TIMEOUT_MS = 300;

/** 사용자 동작(키·터치) 안에서 멈춘 오디오를 깨운다. 브라우저가 응답하지 않아도 오래 기다리지 않는다. */
async function wake(ctx: AudioContext): Promise<void> {
  if (ctx.state === 'running' || ctx.state === 'closed') {
    return;
  }
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, RESUME_TIMEOUT_MS));
  await Promise.race([ctx.resume().catch(() => undefined), timeout]);
}

export function createClipPlayer(options: ClipPlayerOptions): ClipPlayer {
  const fetchClip = options.fetchClip ?? defaultFetch;
  const createContext = options.createContext ?? defaultContext;
  /** undefined: 아직 만들지 않음, null: 사용할 수 없음 */
  let context: AudioContext | null | undefined;
  /** 파일별로 한 번만 내려받고 해독한다 (실패하면 지워서 다음에 다시 시도) */
  const buffers = new Map<string, Promise<AudioBuffer>>();
  let playing: readonly AudioBufferSourceNode[] = [];
  /** play/stop마다 올라가는 번호. 늦게 끝난 옛 요청은 버린다. */
  let generation = 0;
  let disposed = false;

  function getContext(): AudioContext | null {
    if (context?.state === 'closed') {
      context = undefined;
      buffers.clear();
    }
    if (context === undefined) {
      try {
        context = createContext();
      } catch {
        context = null;
      }
    }
    return context;
  }

  function load(ctx: AudioContext, file: string): Promise<AudioBuffer> {
    const cached = buffers.get(file);
    if (cached) {
      return cached;
    }
    const loading = fetchClip(`${options.baseUrl}${file}`).then((data) =>
      ctx.decodeAudioData(data),
    );
    buffers.set(file, loading);
    loading.catch(() => {
      if (buffers.get(file) === loading) {
        buffers.delete(file);
      }
    });
    return loading;
  }

  function stopPlaying(): void {
    playing.forEach((source) => {
      try {
        source.stop();
      } catch {
        // 이미 끝난 소리는 멈출 수 없다.
      }
    });
    playing = [];
  }

  /** 만들 때마다 바로 playing에 넣어, 중간에 실패해도 이미 시작한 소리를 멈출 수 있게 한다. */
  function schedule(ctx: AudioContext, clips: readonly AudioBuffer[], volume: number): void {
    const gain = ctx.createGain();
    gain.gain.value = CLIP_GAIN * Math.min(1, volume);
    gain.connect(ctx.destination);
    let startAt = ctx.currentTime + START_DELAY_S;
    clips.forEach((buffer) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);
      playing = [...playing, source];
      source.start(startAt);
      startAt += buffer.duration + GAP_BETWEEN_CLIPS_S;
    });
  }

  function stop(): void {
    generation += 1;
    stopPlaying();
  }

  async function play(texts: readonly string[], volume: number): Promise<boolean> {
    generation += 1;
    const mine = generation;
    stopPlaying();
    if (disposed) {
      return false;
    }
    if (!(volume > 0) || texts.length === 0) {
      return true;
    }
    const ctx = getContext();
    if (!ctx) {
      return false;
    }
    let clips: AudioBuffer[];
    try {
      // 깨우기와 내려받기를 함께 해서 첫 글자도 빨리 나오게 한다.
      const loads = Promise.all(texts.map((text) => load(ctx, voiceClipFile(text))));
      [, clips] = await Promise.all([wake(ctx), loads]);
    } catch {
      return false;
    }
    if (mine !== generation || ctx.state !== 'running') {
      return false;
    }
    try {
      schedule(ctx, clips, volume);
      return true;
    } catch {
      stopPlaying();
      return false;
    }
  }

  return {
    play,
    stop,
    dispose() {
      stop();
      disposed = true;
      if (context && context.state !== 'closed') {
        void context.close().catch(() => undefined);
      }
      context = undefined;
      buffers.clear();
    },
  };
}

/**
 * MeloTTS 음성 파일로 읽고, 파일을 못 쓰면 기기 내장 음성(fallback)으로 대신 읽는 Speaker.
 * "알 기역"처럼 여러 낱말이면 낱말마다 파일을 이어 재생한다.
 */
export function createClipSpeaker(player: ClipPlayer, fallback: Speaker): Speaker {
  let request = 0;

  return {
    speak(text, volume) {
      request += 1;
      const mine = request;
      fallback.stop();
      const words = text.split(/\s+/).filter((word) => word !== '');
      void player.play(words, volume).then((played) => {
        if (!played && mine === request) {
          fallback.speak(text, volume);
        }
      });
    },
    hasVoice: () => true,
    stop() {
      request += 1;
      player.stop();
      fallback.stop();
    },
    dispose() {
      player.dispose();
      fallback.dispose();
    },
  };
}
