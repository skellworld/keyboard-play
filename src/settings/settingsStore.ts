import type { DisplayMode, LetterCase } from '../input/keymap';

export interface Settings {
  readonly mode: DisplayMode;
  readonly letterCase: LetterCase;
  readonly soundOn: boolean;
  /** 0 ~ 1 */
  readonly volume: number;
  readonly speechOn: boolean;
  readonly touchOn: boolean;
}

export const SETTINGS_STORAGE_KEY = 'kids-keyboard.settings.v1';

export const DEFAULT_SETTINGS: Settings = Object.freeze({
  mode: 'number-hangul',
  letterCase: 'upper',
  soundOn: true,
  volume: 0.7,
  speechOn: true,
  touchOn: true,
});

const DISPLAY_MODES: readonly DisplayMode[] = ['number-hangul', 'number-latin', 'latin-hangul'];
const LETTER_CASES: readonly LetterCase[] = ['upper', 'lower'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.find((option) => option === value) ?? fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function unitIntervalOr(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}

/** 저장소에서 읽은 값(신뢰할 수 없음)을 검증한다. 잘못된 칸만 기본값으로 바꾼다. */
export function parseSettings(raw: unknown): Settings {
  if (!isRecord(raw)) {
    return DEFAULT_SETTINGS;
  }
  return {
    mode: oneOf(raw.mode, DISPLAY_MODES, DEFAULT_SETTINGS.mode),
    letterCase: oneOf(raw.letterCase, LETTER_CASES, DEFAULT_SETTINGS.letterCase),
    soundOn: booleanOr(raw.soundOn, DEFAULT_SETTINGS.soundOn),
    volume: unitIntervalOr(raw.volume, DEFAULT_SETTINGS.volume),
    speechOn: booleanOr(raw.speechOn, DEFAULT_SETTINGS.speechOn),
    touchOn: booleanOr(raw.touchOn, DEFAULT_SETTINGS.touchOn),
  };
}

/**
 * localStorage에 접근만 해도 예외가 날 수 있다 (사이트 데이터 차단 시 SecurityError).
 * 접근을 감싸서 실패하면 null을 돌려준다.
 */
export function getSafeStorage(access: () => Storage = () => window.localStorage): Storage | null {
  try {
    return access();
  } catch {
    return null;
  }
}

/**
 * 저장된 설정을 불러온다. 저장소가 막혀 있거나(시크릿 모드 등) 값이 깨져 있으면
 * 놀이를 막지 않도록 기본값을 돌려준다.
 */
export function loadSettings(storage: Pick<Storage, 'getItem'> | null): Settings {
  if (!storage) {
    return DEFAULT_SETTINGS;
  }
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    return raw === null ? DEFAULT_SETTINGS : parseSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** 설정을 저장한다. 실패하면 false (부모 메뉴에서 "저장 안 됨"을 알릴 수 있게). */
export function saveSettings(
  storage: Pick<Storage, 'setItem'> | null,
  settings: Settings,
): boolean {
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
