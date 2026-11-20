import './styles/fonts.css';
import './styles/global.css';
import './styles/play.css';
import { mountApp } from './app/mountApp';

/** 글꼴은 글자별로 나눠 필요할 때 받는다. 첫 글자 크기를 잴 때 대체 글꼴로 재지 않도록 미리 받아 둔다. */
const JUA_PRELOAD_TEXT =
  'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎㅏㅐㅑㅒㅓㅔㅕㅖㅗㅛㅜㅠㅡㅣ0123456789AZaz';

const root = document.getElementById('app');
if (!root) {
  throw new Error('#app 요소를 찾을 수 없습니다');
}
// 글꼴을 못 받아도(오프라인 첫 실행 등) 대체 글꼴로 놀이는 계속된다.
void document.fonts.load(`1em Jua`, JUA_PRELOAD_TEXT).catch(() => undefined);
const cleanup = mountApp(root);
import.meta.hot?.dispose(cleanup);
