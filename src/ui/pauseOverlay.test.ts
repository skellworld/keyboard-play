import { describe, expect, it, vi } from 'vitest';
import { createPauseOverlay } from './pauseOverlay';

describe('createPauseOverlay', () => {
  it('asks a parent to tap to continue', () => {
    const overlay = createPauseOverlay(vi.fn());

    expect(overlay.textContent).toContain('누르면 다시 시작');
  });

  it('resumes when tapped anywhere', () => {
    const onResume = vi.fn();
    const overlay = createPauseOverlay(onResume);

    overlay.click();

    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
