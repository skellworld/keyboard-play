import { describe, expect, it, vi } from 'vitest';
import { createStartScreen, detectPlatform } from './startScreen';

describe('detectPlatform', () => {
  it.each([
    [
      'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/157.0 Safari/537.36',
      'android',
    ],
    [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/157.0 Safari/537.36',
      'desktop',
    ],
  ] as const)('%s → %s', (userAgent, platform) => {
    expect(detectPlatform(userAgent)).toBe(platform);
  });
});

describe('createStartScreen', () => {
  function render(platform: 'android' | 'desktop') {
    const onStart = vi.fn();
    const onOpenMenu = vi.fn();
    const element = createStartScreen({ platform, onStart, onOpenMenu });
    return { element, onStart, onOpenMenu };
  }

  it('starts play from the big start button', () => {
    const { element, onStart } = render('desktop');

    element.querySelector<HTMLButtonElement>('.start-screen__start')?.click();

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('opens the parent menu from the settings button', () => {
    const { element, onOpenMenu } = render('desktop');

    element.querySelector<HTMLButtonElement>('.start-screen__menu')?.click();

    expect(onOpenMenu).toHaveBeenCalledTimes(1);
  });

  it('tells parents how to leave', () => {
    const { element } = render('desktop');

    expect(element.textContent).toContain('Ctrl + Alt + P');
    expect(element.textContent).toContain('오른쪽 위 모서리');
  });

  it('explains Android screen pinning only on Android', () => {
    expect(render('android').element.textContent).toContain('앱 고정');
    expect(render('desktop').element.textContent).not.toContain('앱 고정');
  });

  it('recommends Chrome or Edge on a computer', () => {
    expect(render('desktop').element.textContent).toContain('Chrome');
  });
});
