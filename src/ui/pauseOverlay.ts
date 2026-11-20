import { el } from './dom';

/**
 * 전체화면이 의도치 않게 풀렸을 때(Esc 길게 누름 등) 놀이를 멈추고 띄우는 화면 (FR-25).
 * 화면 어디든 누르면 다시 전체화면으로 돌아간다 (누르는 동작이 전체화면 요청에 필요한 사용자 동작).
 */
export function createPauseOverlay(onResume: () => void): HTMLButtonElement {
  const overlay = el('button', 'pause-overlay');
  overlay.type = 'button';
  overlay.append(
    el('span', 'pause-overlay__title', '잠깐 멈췄어요'),
    el('span', 'pause-overlay__hint', '부모님, 화면을 누르면 다시 시작해요'),
  );
  overlay.addEventListener('click', onResume);
  return overlay;
}
