import type { DisplayMode, LetterCase } from '../input/keymap';
import type { FeatureState, LockStatus } from '../lock/screenLock';
import type { LiveSettings } from '../settings/liveSettings';
import type { Settings } from '../settings/settingsStore';
import { button, el } from './dom';

export type VoiceState = 'available' | 'missing';

export interface MenuStatus {
  /** 마지막으로 잠금을 시도했을 때의 결과 */
  readonly lock: LockStatus;
  readonly voice: VoiceState;
}

export interface ParentMenuOptions {
  readonly settings: LiveSettings;
  readonly getStatus: () => MenuStatus;
  readonly onPlay: () => void;
}

export interface ParentMenu {
  readonly element: HTMLElement;
  /** 현재 설정·상태로 화면을 다시 맞춘다 (메뉴를 열 때 부른다). */
  refresh(): void;
}

type ToggleName = 'soundOn' | 'speechOn' | 'touchOn';

const MODE_OPTIONS: ReadonlyArray<readonly [DisplayMode, string]> = [
  ['number-hangul', '숫자 + 한글'],
  ['number-latin', '숫자 + 영어'],
  ['latin-hangul', '영어 + 한글 함께'],
];
const CASE_OPTIONS: ReadonlyArray<readonly [LetterCase, string]> = [
  ['upper', '대문자 ABC'],
  ['lower', '소문자 abc'],
];
const TOGGLES: ReadonlyArray<readonly [ToggleName, string]> = [
  ['soundOn', '효과음'],
  ['speechOn', '글자 이름 읽어주기'],
  ['touchOn', '화면 터치 반응'],
];
const FEATURE_TEXT: Readonly<Record<FeatureState, string>> = {
  on: '켜짐',
  off: '꺼짐',
  failed: '실패',
  unsupported: '지원 안 함',
};
const VOICE_TEXT: Readonly<Record<VoiceState, string>> = {
  available: '있음',
  missing: '없음 — 효과음만 나와요',
};
const FINISH_GUIDE =
  '완전히 끝내려면 브라우저 탭을 닫으세요. 안드로이드에서 앱 고정을 켰다면 뒤로 + 최근 앱 버튼을 함께 길게 눌러 해제하세요.';

function radioGroup(
  name: string,
  legend: string,
  options: ReadonlyArray<readonly [string, string]>,
) {
  const fieldset = el('fieldset', 'parent-menu__group');
  fieldset.append(el('legend', '', legend));
  options.forEach(([value, label]) => {
    const wrapper = el('label', 'parent-menu__choice');
    const input = el('input', '');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    wrapper.append(input, document.createTextNode(label));
    fieldset.append(wrapper);
  });
  return fieldset;
}

function toggle(name: ToggleName, label: string): HTMLLabelElement {
  const wrapper = el('label', 'parent-menu__toggle');
  const input = el('input', '');
  input.type = 'checkbox';
  input.name = name;
  wrapper.append(input, document.createTextNode(label));
  return wrapper;
}

function volumeSlider(): HTMLLabelElement {
  const wrapper = el('label', 'parent-menu__volume');
  const input = el('input', '');
  input.type = 'range';
  input.name = 'volume';
  input.min = '0';
  input.max = '100';
  input.step = '5';
  wrapper.append(document.createTextNode('소리 크기'), input);
  return wrapper;
}

/** 입력 요소 하나의 값을 설정 변경으로 바꾼다. 값 검증은 settings.update(parseSettings)가 맡는다. */
function patchFrom(input: HTMLInputElement): Partial<Settings> | null {
  switch (input.name) {
    case 'mode':
      return input.checked ? { mode: input.value as DisplayMode } : null;
    case 'letterCase':
      return input.checked ? { letterCase: input.value as LetterCase } : null;
    case 'volume':
      return { volume: Number(input.value) / 100 };
    case 'soundOn':
    case 'speechOn':
    case 'touchOn':
      return { [input.name]: input.checked };
    default:
      return null;
  }
}

export function createParentMenu(options: ParentMenuOptions): ParentMenu {
  const element = el('section', 'parent-menu');
  element.setAttribute('aria-label', '부모 메뉴');
  element.hidden = true;

  const form = el('form', 'parent-menu__form');
  form.addEventListener('submit', (event) => event.preventDefault());
  const toggles = el('div', 'parent-menu__group');
  TOGGLES.forEach(([name, label]) => toggles.append(toggle(name, label)));
  toggles.append(volumeSlider());
  form.append(
    radioGroup('mode', '보여 줄 글자', MODE_OPTIONS),
    radioGroup('letterCase', '영어 글자', CASE_OPTIONS),
    toggles,
  );

  const saveWarning = el(
    'p',
    'parent-menu__save-warning',
    '설정을 저장하지 못했어요. 이번에는 적용되지만 다음 실행 때는 기본값으로 돌아가요.',
  );
  saveWarning.hidden = true;

  const status = el('dl', 'parent-menu__status');
  const play = button('parent-menu__play', '다시 놀기', options.onPlay);
  // 메뉴를 열 때 키보드·화면 읽기 사용자가 여기서 시작하도록 제목에 초점을 둔다.
  const title = el('h2', 'parent-menu__title', '부모 메뉴');
  title.tabIndex = -1;

  element.append(
    title,
    form,
    saveWarning,
    el('h3', 'parent-menu__subtitle', '지난번 잠금 상태'),
    status,
    play,
    el('p', 'parent-menu__finish', FINISH_GUIDE),
  );

  const apply = (event: Event): void => {
    const patch = event.target instanceof HTMLInputElement ? patchFrom(event.target) : null;
    if (patch) {
      saveWarning.hidden = options.settings.update(patch);
    }
  };
  const isVolume = (event: Event): boolean =>
    event.target instanceof HTMLInputElement && event.target.name === 'volume';
  // 소리 크기는 움직이는 동안(input) 바로 반영, 나머지는 바뀔 때(change) 한 번만 저장한다.
  form.addEventListener('input', (event) => {
    if (isVolume(event)) {
      apply(event);
    }
  });
  form.addEventListener('change', (event) => {
    if (!isVolume(event)) {
      apply(event);
    }
  });

  function renderStatus(): void {
    const { lock, voice } = options.getStatus();
    const rows: ReadonlyArray<readonly [string, string]> = [
      ['전체화면', FEATURE_TEXT[lock.fullscreen]],
      ['키 잠금', FEATURE_TEXT[lock.keyboardLock]],
      ['화면 꺼짐 방지', FEATURE_TEXT[lock.wakeLock]],
      ['한국어 음성', VOICE_TEXT[voice]],
    ];
    status.replaceChildren(
      ...rows.flatMap(([term, value]) => [el('dt', '', term), el('dd', '', value)]),
    );
  }

  function syncControls(): void {
    const current = options.settings.get();
    form.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
      if (input.type === 'radio') {
        input.checked = current[input.name as 'mode' | 'letterCase'] === input.value;
      } else if (input.type === 'checkbox') {
        input.checked = current[input.name as ToggleName];
      } else if (input.name === 'volume') {
        input.value = String(Math.round(current.volume * 100));
      }
    });
  }

  return {
    element,
    refresh() {
      syncControls();
      renderStatus();
      if (!element.hidden) {
        title.focus({ preventScroll: true });
      }
    },
  };
}
