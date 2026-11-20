import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountApp } from './mountApp';

function pressKey(code: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
}

describe('mountApp', () => {
  let root: HTMLElement;
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    root = document.createElement('div');
    document.body.append(root);
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    root.remove();
    vi.useRealTimers();
  });

  it('renders the app title, the play stage and the parent hint', () => {
    cleanup = mountApp(root, { storage: null });

    expect(root.querySelector('h1')?.textContent).toBe('키보드 놀이');
    expect(root.querySelector('.stage')).not.toBeNull();
    expect(root.querySelector('.parent-hint')).not.toBeNull();
    expect(root.querySelector('.exit-corner')).not.toBeNull();
  });

  it('replaces any existing content in the root element', () => {
    const old = document.createElement('p');
    old.className = 'old-content';
    root.append(old);

    cleanup = mountApp(root, { storage: null });

    expect(root.querySelector('.old-content')).toBeNull();
  });

  it('shows a glyph when a key is pressed', () => {
    cleanup = mountApp(root, { storage: null });

    pressKey('KeyR');

    expect(root.querySelector('.sprite__char')?.textContent).toBe('ㄱ');
  });

  it('shows a burst where the stage is touched', () => {
    cleanup = mountApp(root, { storage: null });

    root
      .querySelector('.stage')
      ?.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, clientY: 200, bubbles: true }));

    expect(root.querySelector<HTMLElement>('.sprite--burst')?.style.left).toBe('100px');
  });

  it('uses saved settings', () => {
    const storage = {
      getItem: () => JSON.stringify({ mode: 'number-latin' }),
    } as unknown as Storage;
    cleanup = mountApp(root, { storage });

    pressKey('KeyR');

    expect(root.querySelector('.sprite__char')?.textContent).toBe('R');
  });

  it('stops reacting after cleanup', () => {
    const stop = mountApp(root, { storage: null });

    stop();
    pressKey('KeyR');

    expect(root.querySelector('.sprite')).toBeNull();
  });
});
