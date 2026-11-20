import './styles/global.css';
import { mountApp } from './app/mountApp';

const root = document.getElementById('app');
if (!root) {
  throw new Error('#app 요소를 찾을 수 없습니다');
}
mountApp(root);
