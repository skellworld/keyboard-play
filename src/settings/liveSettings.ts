import { loadSettings, parseSettings, saveSettings, type Settings } from './settingsStore';

/** 실행 중에 바뀌는 설정. 부모 메뉴에서 바꾸면 바로 놀이에 반영되고 저장된다. */
export interface LiveSettings {
  get(): Settings;
  /** 바꾼 뒤 저장에 성공하면 true (실패해도 이번 실행 동안은 바뀐 값이 쓰인다) */
  update(patch: Partial<Settings>): boolean;
  subscribe(listener: (settings: Settings) => void): () => void;
}

export function createLiveSettings(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
): LiveSettings {
  let current = loadSettings(storage);
  const listeners = new Set<(settings: Settings) => void>();

  return {
    get: () => current,
    update(patch) {
      current = parseSettings({ ...current, ...patch });
      const saved = saveSettings(storage, current);
      listeners.forEach((listener) => listener(current));
      return saved;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
