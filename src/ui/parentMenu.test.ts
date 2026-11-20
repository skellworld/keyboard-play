import { describe, expect, it, vi } from 'vitest';
import { createLiveSettings } from '../settings/liveSettings';
import { SETTINGS_STORAGE_KEY } from '../settings/settingsStore';
import { createParentMenu, type MenuStatus } from './parentMenu';

const STATUS: MenuStatus = {
  lock: { fullscreen: 'on', keyboardLock: 'unsupported', wakeLock: 'failed' },
  voice: 'available',
};

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

function setup(
  status: MenuStatus = STATUS,
  storage: ReturnType<typeof memoryStorage> | null = memoryStorage(),
) {
  const settings = createLiveSettings(storage);
  const onPlay = vi.fn();
  const menu = createParentMenu({ settings, getStatus: () => status, onPlay });
  menu.refresh();
  const $ = <T extends HTMLElement>(selector: string) =>
    menu.element.querySelector<T>(selector) as T;
  return { settings, onPlay, menu, $ };
}

function change(input: HTMLInputElement, type: 'change' | 'input' = 'change'): void {
  input.dispatchEvent(new Event(type, { bubbles: true }));
}

describe('createParentMenu controls', () => {
  it('shows the current settings', () => {
    const { $ } = setup();

    expect($<HTMLInputElement>('input[name="mode"][value="number-hangul"]').checked).toBe(true);
    expect($<HTMLInputElement>('input[name="letterCase"][value="upper"]').checked).toBe(true);
    expect($<HTMLInputElement>('input[name="soundOn"]').checked).toBe(true);
    expect($<HTMLInputElement>('input[name="volume"]').value).toBe('70');
  });

  it('applies a new display mode right away', () => {
    const { settings, $ } = setup();
    const latin = $<HTMLInputElement>('input[name="mode"][value="number-latin"]');

    latin.checked = true;
    change(latin);

    expect(settings.get().mode).toBe('number-latin');
  });

  it('applies the volume while the slider moves', () => {
    const { settings, $ } = setup();
    const volume = $<HTMLInputElement>('input[name="volume"]');

    volume.value = '35';
    change(volume, 'input');

    expect(settings.get().volume).toBeCloseTo(0.35);
  });

  it.each(['soundOn', 'speechOn', 'touchOn'] as const)('toggles %s', (name) => {
    const { settings, $ } = setup();
    const box = $<HTMLInputElement>(`input[name="${name}"]`);

    box.checked = false;
    change(box);

    expect(settings.get()[name]).toBe(false);
  });

  it('follows settings changed elsewhere after refresh', () => {
    const { settings, menu, $ } = setup();

    settings.update({ letterCase: 'lower' });
    menu.refresh();

    expect($<HTMLInputElement>('input[name="letterCase"][value="lower"]').checked).toBe(true);
  });
});

describe('createParentMenu status and actions', () => {
  it('shows the lock and voice status in plain words', () => {
    const { menu } = setup();
    const text = menu.element.textContent ?? '';

    expect(text).toContain('전체화면');
    expect(text).toContain('켜짐');
    expect(text).toContain('지원 안 함');
    expect(text).toContain('실패');
    expect(text).toContain('한국어 음성');
  });

  it('says when there is no Korean voice', () => {
    const { menu } = setup({ ...STATUS, voice: 'missing' });

    expect(menu.element.textContent).toContain('효과음만');
  });

  it('warns when settings could not be saved', () => {
    const { $ } = setup(STATUS, null);
    const box = $<HTMLInputElement>('input[name="touchOn"]');

    box.checked = false;
    change(box);

    expect($<HTMLElement>('.parent-menu__save-warning').hidden).toBe(false);
  });

  it('does not warn while saving works', () => {
    const { $ } = setup();

    expect($<HTMLElement>('.parent-menu__save-warning').hidden).toBe(true);
    expect(SETTINGS_STORAGE_KEY).toBeTruthy();
  });

  it('starts play again from the play button', () => {
    const { onPlay, $ } = setup();

    $<HTMLButtonElement>('.parent-menu__play').click();

    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('explains how to finish completely', () => {
    expect(setup().menu.element.textContent).toContain('탭을 닫');
  });

  it('moves keyboard focus to the menu title when opened', () => {
    const { menu, $ } = setup();
    document.body.append(menu.element);
    menu.element.hidden = false;

    menu.refresh();

    expect(document.activeElement).toBe($('.parent-menu__title'));
    menu.element.remove();
  });

  it('saves the volume once per slider movement', () => {
    const { settings, $ } = setup();
    const update = vi.spyOn(settings, 'update');
    const volume = $<HTMLInputElement>('input[name="volume"]');

    volume.value = '40';
    change(volume, 'input');
    change(volume, 'change');

    expect(update).toHaveBeenCalledTimes(1);
  });
});
