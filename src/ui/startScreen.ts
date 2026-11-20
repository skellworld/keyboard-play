import { button, el } from './dom';

export type Platform = 'android' | 'desktop';

export interface StartScreenOptions {
  readonly platform: Platform;
  readonly onStart: () => void;
  readonly onOpenMenu: () => void;
}

export function detectPlatform(userAgent: string): Platform {
  return /Android/i.test(userAgent) ? 'android' : 'desktop';
}

const EXIT_GUIDE =
  '나가기: 오른쪽 위 모서리를 3초 누르거나 Ctrl + Alt + P를 3초 누른 뒤, 나타나는 "나가기" 버튼을 누르세요.';
const ANDROID_GUIDE =
  '앱 고정을 켜 두면 홈·최근 앱 버튼으로도 나갈 수 없어요. 설정 › 보안 및 개인정보 보호 › 기타 보안 설정 › 앱 고정';
const DESKTOP_GUIDE =
  'Chrome 또는 Edge에서 실행하세요. Esc를 길게 누르면 전체화면이 풀리고 놀이가 잠깐 멈춰요.';

/** 시작 화면: 시작 버튼은 전체화면 요청에 필요한 "사용자 동작"이 된다 (FR-20). */
export function createStartScreen(options: StartScreenOptions): HTMLElement {
  const screen = el('section', 'start-screen');
  screen.setAttribute('aria-label', '시작 화면');

  const hero = el('div', 'start-screen__hero');
  const emoji = el('p', 'start-screen__emoji', '🐻 ⭐ 🌸');
  emoji.setAttribute('aria-hidden', 'true');
  hero.append(
    emoji,
    el('h2', 'start-screen__title', '키보드 놀이'),
    el('p', 'start-screen__lead', '키를 누르면 글자가 톡! 나타나요'),
  );

  const start = button('start-screen__start', '시작하기', options.onStart);

  const guide = el('div', 'start-screen__guide');
  const list = el('ul', 'start-screen__guide-list');
  const platformGuide = options.platform === 'android' ? ANDROID_GUIDE : DESKTOP_GUIDE;
  list.append(el('li', '', EXIT_GUIDE), el('li', '', platformGuide));
  guide.append(el('p', 'start-screen__guide-title', '부모님께'), list);

  const menu = button('start-screen__menu', '설정', options.onOpenMenu);

  screen.append(hero, start, guide, menu);
  return screen;
}
