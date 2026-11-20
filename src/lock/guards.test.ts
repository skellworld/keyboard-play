import { afterEach, describe, expect, it, vi } from 'vitest';
import { armHistoryTrap, installGuards } from './guards';

function keydown(code: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { code, cancelable: true, bubbles: true });
  window.dispatchEvent(event);
  return event;
}

describe('installGuards', () => {
  let uninstall: (() => void) | undefined;

  afterEach(() => {
    uninstall?.();
    uninstall = undefined;
    vi.restoreAllMocks();
  });

  it('blocks browser key actions while locked, including keys the game ignores', () => {
    uninstall = installGuards(window, () => true);

    expect(keydown('F5').defaultPrevented).toBe(true);
    expect(keydown('Tab').defaultPrevented).toBe(true);
  });

  it('leaves keys alone when not locked (parent menu)', () => {
    uninstall = installGuards(window, () => false);

    expect(keydown('Tab').defaultPrevented).toBe(false);
  });

  it('blocks the long-press / right-click menu while locked', () => {
    uninstall = installGuards(window, () => true);
    const event = new MouseEvent('contextmenu', { cancelable: true, bubbles: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('pushes the history entry back when the back button is used while locked', () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    uninstall = installGuards(window, () => true);

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(pushState).toHaveBeenCalled();
  });

  it('stops guarding after uninstall', () => {
    const stop = installGuards(window, () => true);

    stop();

    expect(keydown('F5').defaultPrevented).toBe(false);
  });
});

describe('armHistoryTrap', () => {
  it('adds a history entry so the first back press stays in the app', () => {
    window.history.replaceState(null, ''); // 앞 테스트가 남긴 항목 지우기
    const pushState = vi.spyOn(window.history, 'pushState');

    armHistoryTrap(window);

    expect(pushState).toHaveBeenCalledTimes(1);
  });

  it('does not pile up entries when armed again (e.g. resume after pause)', () => {
    armHistoryTrap(window);
    const pushState = vi.spyOn(window.history, 'pushState');

    armHistoryTrap(window);

    expect(pushState).not.toHaveBeenCalled();
  });
});
