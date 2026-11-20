import { describe, expect, it } from 'vitest';
import { createExitCornerMarker, createParentHint } from './hint';

describe('createParentHint', () => {
  it('tells parents both ways to leave', () => {
    const hint = createParentHint();

    expect(hint.textContent).toContain('오른쪽 위 모서리');
    expect(hint.textContent).toContain('Ctrl + Alt + P');
    expect(hint.textContent).toContain('3초');
    expect(hint.classList).toContain('parent-hint');
  });
});

describe('createExitCornerMarker', () => {
  it('creates a decorative marker that does not block touches', () => {
    const marker = createExitCornerMarker();

    expect(marker.classList).toContain('exit-corner');
    expect(marker.getAttribute('aria-hidden')).toBe('true');
  });
});
