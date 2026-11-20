/** 작은 DOM 도우미. 글자는 항상 textContent로 넣어 HTML로 해석되지 않게 한다. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

export function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const element = el('button', className, text);
  element.type = 'button';
  element.addEventListener('click', onClick);
  return element;
}
