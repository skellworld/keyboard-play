import { el } from './dom';

/** 3초 중 처음 1초는 보이지 않게 (아이가 우연히 눌렀을 때 눈에 덜 띄도록, FR-33) */
export const RING_VISIBLE_FROM = 1 / 3;

export interface HoldRing {
  readonly element: HTMLElement;
  /** 0 ~ 1 */
  setProgress(progress: number): void;
}

/** 오른쪽 위 모서리에 나타나는 나가기 진행 링 */
export function createHoldRing(): HoldRing {
  const element = el('div', 'hold-ring');
  element.setAttribute('aria-hidden', 'true');
  element.hidden = true;

  return {
    element,
    setProgress(progress) {
      const show = progress >= RING_VISIBLE_FROM;
      element.hidden = !show;
      if (show) {
        element.style.setProperty('--progress', String(Math.round(progress * 1000) / 1000));
      }
    },
  };
}
