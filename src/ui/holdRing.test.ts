import { describe, expect, it } from 'vitest';
import { createHoldRing } from './holdRing';

describe('createHoldRing', () => {
  it('stays hidden at first and during the first second (so a child barely notices it)', () => {
    const ring = createHoldRing();

    expect(ring.element.hidden).toBe(true);
    ring.setProgress(0.2);
    expect(ring.element.hidden).toBe(true);
  });

  it('shows the progress after the first second', () => {
    const ring = createHoldRing();

    ring.setProgress(0.5);

    expect(ring.element.hidden).toBe(false);
    expect(ring.element.style.getPropertyValue('--progress')).toBe('0.5');
  });

  it('hides again when the hold stops', () => {
    const ring = createHoldRing();
    ring.setProgress(0.8);

    ring.setProgress(0);

    expect(ring.element.hidden).toBe(true);
  });

  it('is decorative for screen readers', () => {
    expect(createHoldRing().element.getAttribute('aria-hidden')).toBe('true');
  });
});
