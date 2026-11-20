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
npm run icons      # 앱 아이콘 다시 만들기 (scripts/generate-icons.mjs)
```

## 음성

글자 이름은 [MeloTTS](https://github.com/myshell-ai/MeloTTS)로 미리 만든 `public/voice/*.ogg`를 재생한다.
읽는 말을 바꾸면 [tools/tts/README.md](tools/tts/README.md)대로 다시 만든다.

## 배포 (GitHub Pages)

`main` 브랜치에 push하면 [deploy.yml](.github/workflows/deploy.yml)이 검사 → E2E → 빌드 → 배포를 한다.
주소는 `https://<사용자>.github.io/<저장소>/`.

처음 한 번만:

1. GitHub에서 **공개(public)** 저장소를 만든다 (무료 계정은 공개 저장소만 Pages 사용 가능).
2. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꾼다.
3. 로컬 저장소에 원격을 연결하고 push한다.

## 태블릿·PC에서 쓰기

- 배포 주소를 Chrome으로 한 번 연다 → 메뉴의 **홈 화면에 추가**(설치) → 이후에는 인터넷 없이도 열린다.
- 안드로이드는 **앱 고정**을 켜 두면 아이가 홈·최근 앱 버튼으로도 나가지 못한다.
- 나가기: 오른쪽 위 모서리 또는 Ctrl + Alt + P를 3초 → "나가기" 버튼.
