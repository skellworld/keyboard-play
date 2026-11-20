import { describe, expect, it, vi } from 'vitest';
import { createLiveSettings } from './liveSettings';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from './settingsStore';

function memoryStorage(initial?: object) {
  const data = new Map<string, string>();
  if (initial) {
    data.set(SETTINGS_STORAGE_KEY, JSON.stringify(initial));
  }
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe('createLiveSettings', () => {
  it('starts with the saved settings', () => {
    const live = createLiveSettings(memoryStorage({ mode: 'number-latin' }));

    expect(live.get().mode).toBe('number-latin');
  });

  it('merges an update, saves it and reports success', () => {
    const storage = memoryStorage();
    const live = createLiveSettings(storage);

    expect(live.update({ volume: 0.2, speechOn: false })).toBe(true);

    expect(live.get()).toEqual({ ...DEFAULT_SETTINGS, volume: 0.2, speechOn: false });
    expect(JSON.parse(storage.data.get(SETTINGS_STORAGE_KEY) ?? '{}').volume).toBe(0.2);
  });

  it('validates updates', () => {
    const live = createLiveSettings(memoryStorage());

    live.update({ volume: 3 });

    expect(live.get().volume).toBe(1);
  });

  it('notifies subscribers until they unsubscribe', () => {
    const live = createLiveSettings(memoryStorage());
    const listener = vi.fn();
    const unsubscribe = live.subscribe(listener);

    live.update({ touchOn: false });
    unsubscribe();
    live.update({ touchOn: true });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ touchOn: false }));
  });

  it('keeps working in memory when there is no storage', () => {
    const live = createLiveSettings(null);

    expect(live.update({ letterCase: 'lower' })).toBe(false);
    expect(live.get().letterCase).toBe('lower');
  });
});
