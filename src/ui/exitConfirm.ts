import type { Size } from '../render/layout';
import { button, el } from './dom';

/** 패널 크기 (screens.css .exit-confirm__panel과 맞춤) */
export const CONFIRM_PANEL_SIZE: Size = { width: 300, height: 180 };
/** 오른쪽 위 나가기 모서리(80px)와 겹치지 않게 띄울 거리 */
export const CORNER_CLEARANCE = 110;
const EDGE_MARGIN = 16;
const INITIAL_SECONDS = 5;

export interface ExitConfirm {
  readonly element: HTMLElement;
  /**
   * 매번 다른 자리에 띄워 아이가 같은 곳을 눌러 나가는 일을 막는다 (FR-36).
   * allowEnter: 키보드 조합으로 나가기를 했을 때만 Enter 안내를 보여 준다.
   */
  show(viewport: Size, random: () => number, allowEnter?: boolean): void;
  hide(): void;
  setSecondsLeft(seconds: number): void;
}

function hintText(seconds: number, allowEnter: boolean): string {
  const base = `${seconds}초 안에 눌러 주세요`;
  return allowEnter ? `${base} · Enter 키도 돼요` : base;
}

export function createExitConfirm(onConfirm: () => void): ExitConfirm {
  const element = el('div', 'exit-confirm');
  element.hidden = true;
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-labelledby', 'exit-confirm-title');

  const panel = el('div', 'exit-confirm__panel');
  const title = el('p', 'exit-confirm__title', '부모님 확인');
  title.id = 'exit-confirm-title';
  const action = button('exit-confirm__button', '나가기', onConfirm);
  const hint = el('p', 'exit-confirm__hint', hintText(INITIAL_SECONDS, false));
  hint.setAttribute('aria-live', 'polite');
  panel.append(title, action, hint);
  element.append(panel);
  let enterAllowed = false;

  function place(viewport: Size, random: () => number): void {
    const maxLeft = viewport.width - CONFIRM_PANEL_SIZE.width - EDGE_MARGIN;
    const maxTop = viewport.height - CONFIRM_PANEL_SIZE.height - EDGE_MARGIN;
    const left = EDGE_MARGIN + random() * Math.max(0, maxLeft - EDGE_MARGIN);
    const randomTop = EDGE_MARGIN + random() * Math.max(0, maxTop - EDGE_MARGIN);
    const nearCorner = left + CONFIRM_PANEL_SIZE.width > viewport.width - CORNER_CLEARANCE;
    const top = nearCorner
      ? Math.min(Math.max(randomTop, CORNER_CLEARANCE), Math.max(EDGE_MARGIN, maxTop))
      : randomTop;
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }

  return {
    element,
    show(viewport, random, allowEnter = false) {
      enterAllowed = allowEnter;
      place(viewport, random);
      hint.textContent = hintText(INITIAL_SECONDS, enterAllowed);
      element.hidden = false;
    },
    hide() {
      element.hidden = true;
    },
    setSecondsLeft(seconds) {
      hint.textContent = hintText(seconds, enterAllowed);
    },
  };
}
