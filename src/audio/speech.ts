/**
 * 글자 이름 읽어주기: 기기에 내장된 음성(Web Speech API)을 쓴다.
 * - 한국어 음성 하나로 "기역", "에이", "삼"을 모두 읽는다. 기기 내장(오프라인) 음성을 우선.
 * - 새 글자가 오면 지금 읽는 것을 끊고 가장 최근 글자만 읽는다 (FR-08a).
 *   끊은 직후 바로 읽으면 일부 브라우저(특히 안드로이드)가 소리를 내지 않아 잠깐 쉬고 읽는다.
 * - 음성 목록에 한국어가 없으면 조용히 생략한다 (FR-08b). 목록이 아직 비어 있으면
 *   (안드로이드에서 흔함) 기기가 알아서 한국어 음성을 고르도록 일단 시도한다.
 */

export interface UtteranceLike {
  text: string;
  lang: string;
  voice: SpeechSynthesisVoice | null;
  rate: number;
  pitch: number;
  volume: number;
}

export interface SpeechSynthLike {
  readonly speaking?: boolean;
  readonly pending?: boolean;
  readonly paused?: boolean;
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  resume?(): void;
  getVoices(): readonly SpeechSynthesisVoice[];
  addEventListener?(type: 'voiceschanged', listener: () => void): void;
  removeEventListener?(type: 'voiceschanged', listener: () => void): void;
}

export interface Speaker {
  /** volume: 0 ~ 1 */
  speak(text: string, volume: number): void;
  /** 한국어 음성이 목록에 있는지 (부모 메뉴 표시용) */
  hasVoice(): boolean;
  /** 지금 읽는 것과 기다리는 것을 바로 멈춘다 (읽어주기 끔, 화면 숨김). */
  stop(): void;
  dispose(): void;
}

/** 끊은 뒤 다시 읽기까지 쉬는 시간 */
export const RESTART_DELAY_MS = 50;
/** 효과음보다 튀지 않도록 읽기 음량 상한 */
export const SPEECH_MAX_VOLUME = 0.7;
/** 아이에게 들려주기 좋게 조금 느리고 조금 높게 */
const SPEECH_RATE = 0.9;
const SPEECH_PITCH = 1.15;

function defaultSynth(): SpeechSynthLike | null {
  return 'speechSynthesis' in window
    ? (window.speechSynthesis as unknown as SpeechSynthLike)
    : null;
}

function defaultUtterance(text: string): UtteranceLike {
  return new SpeechSynthesisUtterance(text);
}

/** 한국어 음성 중 기기 내장(오프라인) 음성을 먼저 고른다. 'ko-KR', 'ko_KR' 모두 인식. */
export function pickKoreanVoice(
  voices: readonly SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  const korean = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('ko'));
  return korean.find((v) => v.localService) ?? korean[0] ?? null;
}

export function createSpeaker(
  synth: SpeechSynthLike | null = defaultSynth(),
  makeUtterance: (text: string) => UtteranceLike = defaultUtterance,
): Speaker {
  let voice: SpeechSynthesisVoice | null = null;
  let voicesListed = false;
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  // Chrome은 참조가 없는 발화를 읽는 도중 정리해 버릴 수 있어 마지막 발화를 붙잡아 둔다.
  const keepAlive: { utterance: UtteranceLike | null } = { utterance: null };

  function refreshVoice(): void {
    if (!synth) {
      return;
    }
    try {
      const voices = synth.getVoices();
      voicesListed = voices.length > 0;
      voice = pickKoreanVoice(voices);
    } catch {
      voice = null;
    }
  }

  function speakNow(text: string, volume: number): void {
    if (!synth) {
      return;
    }
    try {
      if (synth.paused) {
        synth.resume?.();
      }
      const utterance = makeUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.voice = voice;
      utterance.rate = SPEECH_RATE;
      utterance.pitch = SPEECH_PITCH;
      utterance.volume = SPEECH_MAX_VOLUME * Math.min(1, volume);
      keepAlive.utterance = utterance;
      synth.speak(utterance);
    } catch {
      // 브라우저가 읽기를 거부해도(사용자 동작 전 등) 놀이는 계속된다.
    }
  }

  function clearRestart(): void {
    if (restartTimer !== undefined) {
      clearTimeout(restartTimer);
      restartTimer = undefined;
    }
  }

  refreshVoice();
  // 음성 목록은 늦게 도착하는 경우가 많다 (특히 Chrome).
  synth?.addEventListener?.('voiceschanged', refreshVoice);

  return {
    hasVoice() {
      if (!voice) {
        refreshVoice();
      }
      return voice !== null;
    },
    speak(text, volume) {
      if (!synth || text.trim() === '' || !(volume > 0)) {
        return;
      }
      if (!voice) {
        refreshVoice();
      }
      if (!voice && voicesListed) {
        return;
      }
      const busy = synth.speaking === true || synth.pending === true || restartTimer !== undefined;
      clearRestart();
      if (!busy) {
        speakNow(text, volume);
        return;
      }
      try {
        synth.cancel();
      } catch {
        // 끊기에 실패해도 새 글자는 읽어 본다.
      }
      restartTimer = setTimeout(() => {
        restartTimer = undefined;
        speakNow(text, volume);
      }, RESTART_DELAY_MS);
    },
    stop() {
      clearRestart();
      try {
        synth?.cancel();
      } catch {
        // 멈추기 실패는 무시한다.
      }
    },
    dispose() {
      this.stop();
      synth?.removeEventListener?.('voiceschanged', refreshVoice);
    },
  };
}
