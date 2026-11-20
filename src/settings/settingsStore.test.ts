import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  getSafeStorage,
  loadSettings,
  parseSettings,
  saveSettings,
  SETTINGS_STORAGE_KEY,
  type Settings,
} from './settingsStore';

const CUSTOM: Settings = {
  mode: 'latin-hangul',
  letterCase: 'lower',
  soundOn: false,
  volume: 0.3,
  speechOn: false,
  touchOn: false,
};

function storageWith(value: string | null): Pick<Storage, 'getItem'> {
  return { getItem: () => value };
}

describe('DEFAULT_SETTINGS', () => {
  it('matches the agreed defaults', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      mode: 'number-hangul',
      letterCase: 'upper',
      soundOn: true,
      volume: 0.7,
      speechOn: true,
      touchOn: true,
    });
  });
});

describe('parseSettings', () => {
  it.each([undefined, null, 'garbage', 42, []])('returns defaults for %j', (raw) => {
    expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps every valid field', () => {
    expect(parseSettings({ ...CUSTOM })).toEqual(CUSTOM);
  });

  it('replaces only the invalid fields with defaults', () => {
    const parsed = parseSettings({ ...CUSTOM, mode: 'klingon', soundOn: 'yes' });

    expect(parsed).toEqual({
      ...CUSTOM,
      mode: DEFAULT_SETTINGS.mode,
      soundOn: DEFAULT_SETTINGS.soundOn,
    });
  });

  it.each([
    [1.5, 1],
    [-0.2, 0],
    [0.5, 0.5],
  ])('clamps volume %d to %d', (volume, expected) => {
    expect(parseSettings({ volume }).volume).toBe(expected);
  });

  it.each([Number.NaN, '0.5', null])('uses the default volume for %j', (volume) => {
    expect(parseSettings({ volume }).volume).toBe(DEFAULT_SETTINGS.volume);
  });
});

describe('loadSettings', () => {
  it('reads and parses the saved JSON', () => {
    expect(loadSettings(storageWith(JSON.stringify(CUSTOM)))).toEqual(CUSTOM);
  });

  it('returns defaults when nothing is saved', () => {
    expect(loadSettings(storageWith(null))).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults for broken JSON', () => {
    expect(loadSettings(storageWith('{not json'))).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults when storage is unavailable', () => {
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults when reading storage throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
    };

    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('getSafeStorage', () => {
  it('returns the storage when it can be accessed', () => {
    const storage = {} as Storage;

    expect(getSafeStorage(() => storage)).toBe(storage);
  });

  it('returns null when accessing storage throws (blocked site data)', () => {
    const blocked = (): Storage => {
      throw new DOMException('denied', 'SecurityError');
    };

    expect(getSafeStorage(blocked)).toBeNull();
  });
});

describe('saveSettings', () => {
  it('writes the settings as JSON under the storage key', () => {
    const setItem = vi.fn();

    expect(saveSettings({ setItem }, CUSTOM)).toBe(true);
    expect(setItem).toHaveBeenCalledWith(SETTINGS_STORAGE_KEY, JSON.stringify(CUSTOM));
  });

  it('returns false when writing throws', () => {
    const setItem = vi.fn(() => {
      throw new Error('quota');
    });

    expect(saveSettings({ setItem }, CUSTOM)).toBe(false);
  });

  it('returns false when storage is unavailable', () => {
    expect(saveSettings(null, CUSTOM)).toBe(false);
  });
});
