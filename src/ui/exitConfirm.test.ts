import { describe, expect, it, vi } from 'vitest';
import { CONFIRM_PANEL_SIZE, CORNER_CLEARANCE, createExitConfirm } from './exitConfirm';

const VIEWPORT = { width: 1000, height: 800 };

describe('createExitConfirm', () => {
  it('is hidden until shown', () => {
    const confirm = createExitConfirm(vi.fn());

    expect(confirm.element.hidden).toBe(true);
  });

  it('shows the panel at a random place that stays on screen', () => {
    const confirm = createExitConfirm(vi.fn());

    confirm.show(VIEWPORT, () => 0);
    const panel = confirm.element.querySelector<HTMLElement>('.exit-confirm__panel');
    const nearStart = { left: panel?.style.left, top: panel?.style.top };
    confirm.show(VIEWPORT, () => 0.999);
    const nearEnd = { left: panel?.style.left, top: panel?.style.top };

    expect(confirm.element.hidden).toBe(false);
    expect(Number.parseFloat(nearStart.left ?? '')).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(nearEnd.left ?? '')).toBeLessThanOrEqual(
      VIEWPORT.width - CONFIRM_PANEL_SIZE.width,
    );
    expect(Number.parseFloat(nearEnd.top ?? '')).toBeLessThanOrEqual(
      VIEWPORT.height - CONFIRM_PANEL_SIZE.height,
    );
    expect(nearStart).not.toEqual(nearEnd);
  });

  it('confirms when the button is pressed', () => {
    const onConfirm = vi.fn();
    const confirm = createExitConfirm(onConfirm);
    confirm.show(VIEWPORT, () => 0.5);

    confirm.element.querySelector<HTMLButtonElement>('button')?.click();

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows the seconds left and that Enter also works after a keyboard hold', () => {
    const confirm = createExitConfirm(vi.fn());
    confirm.show(VIEWPORT, () => 0.5, true);

    confirm.setSecondsLeft(3);

    expect(confirm.element.textContent).toContain('3초');
    expect(confirm.element.textContent).toContain('Enter');
  });

  it('does not mention Enter after a corner hold (only the button works then)', () => {
    const confirm = createExitConfirm(vi.fn());
    confirm.show(VIEWPORT, () => 0.5, false);

    confirm.setSecondsLeft(4);

    expect(confirm.element.textContent).toContain('4초');
    expect(confirm.element.textContent).not.toContain('Enter');
  });

  it('keeps the panel away from the top-right exit corner', () => {
    const confirm = createExitConfirm(vi.fn());
    const values = [0.999, 0];
    let call = 0;

    confirm.show(VIEWPORT, () => values[call++] ?? 0);

    const panel = confirm.element.querySelector<HTMLElement>('.exit-confirm__panel');
    expect(Number.parseFloat(panel?.style.top ?? '0')).toBeGreaterThanOrEqual(CORNER_CLEARANCE);
  });

  it('hides again', () => {
    const confirm = createExitConfirm(vi.fn());
    confirm.show(VIEWPORT, () => 0.5);

    confirm.hide();

    expect(confirm.element.hidden).toBe(true);
  });
});
