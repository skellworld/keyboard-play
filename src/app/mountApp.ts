const APP_TITLE = '키보드 놀이';

/** 앱의 첫 화면을 root 요소 안에 그린다. 기존 내용은 교체한다. */
export function mountApp(root: HTMLElement): void {
  const title = document.createElement('h1');
  title.className = 'app-title';
  title.textContent = APP_TITLE;
  root.replaceChildren(title);
}
