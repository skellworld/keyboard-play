import { createFeedback, type Feedback } from '../audio/feedback';
import { createSfx } from '../audio/sfx';
import { createSpeaker } from '../audio/speech';
import { createStage } from '../render/stage';
import { getSafeStorage, loadSettings } from '../settings/settingsStore';
import { createExitCornerMarker, createParentHint } from '../ui/hint';
import { createPlayController } from './playController';

const APP_TITLE = '키보드 놀이';

export interface MountOptions {
  /** 테스트용. 생략하면 localStorage를 안전하게 사용하고, null이면 저장소 없이 기본 설정. */
  readonly storage?: Storage | null;
  readonly random?: () => number;
  readonly now?: () => number;
  /** 테스트용. 생략하면 효과음·읽어주기를 실제로 만든다. */
  readonly feedback?: Feedback;
}

function createTitle(): HTMLElement {
  const title = document.createElement('h1');
  title.className = 'visually-hidden';
  title.textContent = APP_TITLE;
  return title;
}

function windowViewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

/** 놀이 화면을 root에 그리고 입력을 연결한다. 반환된 함수를 부르면 정리한다. */
export function mountApp(root: HTMLElement, options: MountOptions = {}): () => void {
  const storage = options.storage === undefined ? getSafeStorage() : options.storage;
  const settings = loadSettings(storage);
  const getSettings = () => settings;
  const stage = createStage({ random: options.random, viewport: windowViewport });
  const feedback = options.feedback ?? createFeedback(createSfx(), createSpeaker(), getSettings);
  const controller = createPlayController({
    stage,
    feedback,
    getSettings,
    now: options.now ?? (() => performance.now()),
    viewport: windowViewport,
  });

  root.replaceChildren(createTitle(), createParentHint(), stage.element, createExitCornerMarker());

  // 브라우저는 사용자 동작 안에서만 소리를 허용하므로, 입력마다 오디오 잠금 해제를 시도한다 (한 번 풀리면 무시됨).
  const onKeyDown = (event: KeyboardEvent): void => {
    feedback.unlock();
    controller.handleKeyDown(event);
  };
  const onPointerDown = (event: PointerEvent): void => {
    feedback.unlock();
    controller.handlePointerDown({ x: event.clientX, y: event.clientY });
  };

  window.addEventListener('keydown', onKeyDown);
  stage.element.addEventListener('pointerdown', onPointerDown);

  return () => {
    window.removeEventListener('keydown', onKeyDown);
    stage.element.removeEventListener('pointerdown', onPointerDown);
    stage.destroy();
    feedback.dispose();
  };
}
