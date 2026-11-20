# 키보드 놀이

아이(2~3세)가 키보드를 누르면 숫자·영문·한글 자모가 귀엽게 나타나는 웹 앱. 갤럭시 태블릿과 Windows PC에서 전체화면으로 실행한다.

## 문서

- [요구사항](docs/01-requirements.md)
- [구현 계획](docs/02-plan.md)
- [스파이크 결과](docs/03-spike-results.md)

## 개발

```bash
npm install
npm run dev        # http://localhost:5173
npm run dev:lan    # 같은 와이파이의 태블릿에서 접속
npm run check      # 타입 검사 + 린트 + 포맷 검사 + 테스트(커버리지 80%)
npm run e2e        # Playwright (설치된 Chrome 사용)
npm run build
```
