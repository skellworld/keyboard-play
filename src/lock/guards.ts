/**
 * 잠금 중 브라우저 기본 동작 막기 (02-plan 통합 규칙 5).
 * - 모든 키의 기본 동작(새로고침, 뒤로, 찾기, Tab 이동, 스페이스 스크롤 …)을 막는다. 게임이 무시하는 키도 포함.
 * - 길게 누르기/오른쪽 클릭 메뉴를 막는다.
 * - 뒤로가기(안드로이드 뒤로·키보드 Esc 포함)는 history 항목을 다시 넣어 앱에 머문다.
 * 운영체제 키(홈, Win+L, Ctrl+Alt+Del 등)는 웹에서 막을 수 없다 → 앱 고정 안내로 보완.
 */

export function installGuards(win: Window, isLocked: () => boolean): () => void {
  const preventWhileLocked = (event: Event): void => {
    if (isLocked()) {
      event.preventDefault();
    }
  };
  const onPopState = (): void => {
    if (isLocked()) {
      armHistoryTrap(win);
    }
  };

  win.addEventListener('keydown', preventWhileLocked, { capture: true });
  win.addEventListener('keyup', preventWhileLocked, { capture: true });
  win.addEventListener('contextmenu', preventWhileLocked, { capture: true });
  win.addEventListener('popstate', onPopState);

  return () => {
    win.removeEventListener('keydown', preventWhileLocked, { capture: true });
    win.removeEventListener('keyup', preventWhileLocked, { capture: true });
    win.removeEventListener('contextmenu', preventWhileLocked, { capture: true });
    win.removeEventListener('popstate', onPopState);
  };
}

const TRAP_MARKER = 'kidsKeyboardLock';

function isTrapEntry(state: unknown): boolean {
  return typeof state === 'object' && state !== null && TRAP_MARKER in state;
}

/**
 * 뒤로가기 한 번을 받아낼 history 항목을 넣는다 (잠금을 시작할 때 부른다).
 * 이미 그 항목 위에 있으면 다시 넣지 않는다 (일시정지 후 재개 때 항목이 쌓이지 않게).
 */
export function armHistoryTrap(win: Window): void {
  try {
    if (isTrapEntry(win.history.state)) {
      return;
    }
    win.history.pushState({ [TRAP_MARKER]: true }, '');
  } catch {
    // history를 쓸 수 없는 환경이면 뒤로가기 막기만 포기한다.
  }
}
