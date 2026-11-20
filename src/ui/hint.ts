export const PARENT_HINT_TEXT =
  '나가려면 오른쪽 위 모서리를 3초 동안 누르거나, Ctrl + Alt + P를 3초 동안 누르세요';

/** 화면 아래에 흐릿하게 깔리는 부모용 안내 문구 (아이 놀이를 방해하지 않게 연하게). */
export function createParentHint(): HTMLElement {
  const hint = document.createElement('p');
  hint.className = 'parent-hint';
  hint.textContent = PARENT_HINT_TEXT;
  return hint;
}

/** 오른쪽 위 나가기 영역을 아주 흐릿하게 표시한다. 터치는 막지 않는다 (pointer-events: none). */
export function createExitCornerMarker(): HTMLElement {
  const marker = document.createElement('div');
  marker.className = 'exit-corner';
  marker.setAttribute('aria-hidden', 'true');
  return marker;
}
