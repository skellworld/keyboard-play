import { describe, expect, it } from 'vitest';
import { mountApp } from './mountApp';

describe('mountApp', () => {
  it('renders the app title into the root element', () => {
    const root = document.createElement('div');

    mountApp(root);

    expect(root.querySelector('h1')?.textContent).toBe('키보드 놀이');
  });

  it('replaces any existing content in the root element', () => {
    const root = document.createElement('div');
    root.append(document.createElement('p'));

    mountApp(root);

    expect(root.querySelector('p')).toBeNull();
    expect(root.children).toHaveLength(1);
  });
});
