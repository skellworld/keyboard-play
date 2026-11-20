# 구현 계획 — 키보드 놀이 게임 (v0.2)

**참조 요구사항**: [01-requirements.md](01-requirements.md) (v1.1) · **스파이크 결과**: [03-spike-results.md](03-spike-results.md)
**복잡도**: Medium
**작성일**: 2026-11-21

## 요약
웹 앱(PWA) 하나로 갤럭시 태블릿과 Windows PC를 모두 지원한다. 핵심 로직(키 매핑, 고장 키보드 입력 필터, 길게 누르기 판정)은 **화면과 분리된 순수 함수**로 만들어 테스트로 먼저 검증하고(TDD), 그 위에 화면·소리·잠금 기능을 얹는다. 구현 전에 **실제 고장난 키보드로 입력 패턴을 측정하는 스파이크**를 먼저 한다.

## 기존 패턴
신규 프로젝트라 따라 할 기존 코드가 없다. 아래 규칙을 이 프로젝트의 기준으로 새로 정한다.

| 분류 | 규칙 |
|------|------|
| 파일 이름 | `camelCase.ts`, 기능별 폴더 (`input/`, `render/` …), 테스트는 옆에 `*.test.ts` |
| 에러 처리 | 브라우저 API(전체화면, 키 잠금, TTS, 저장소)는 **실패해도 놀이가 계속**되도록 try/catch → 기능만 조용히 끄고 부모 메뉴에 상태 표시 |
| 로깅 | 운영 빌드에서 `console.log` 없음. 기능 실패 상태(키 잠금·음성 등)는 부모 메뉴에 표시 |
| 데이터 | 설정만 `localStorage`에 저장. 읽을 때 형식 검증 후 실패하면 기본값 |
| 테스트 | Vitest(단위·통합, jsdom), Playwright(E2E, Chromium). 시간 의존 로직은 **시계를 주입**해 테스트 |

## 기술 스택

| 용도 | 선택 | 이유 |
|------|------|------|
| 빌드 | Vite 8 + TypeScript 7 | 빠르고 설정이 적음 |
| UI 프레임워크 | **없음** (순수 TS + DOM) | 화면이 단순하고 동시 객체가 30개뿐 → CSS transform 애니메이션으로 충분, 번들 작음 |
| 오프라인·설치 | vite-plugin-pwa 2.0 (MIT) | 검증된 서비스 워커 생성 |
| 글꼴 | @fontsource/jua (OFL-1.1) | 둥근 한글 글꼴, 앱에 포함 → 오프라인 동작 |
| 효과음 | Web Audio API로 **코드로 합성** | 음원 파일·라이선스 문제 없음, 용량 0 |
| 읽어주기 | Web Speech API (`speechSynthesis`) | 기기 내장 음성. 한 음성(ko-KR)으로 "에이", "기역", "일"을 모두 읽음 |
| 테스트 | Vitest 5 + jsdom, @vitest/coverage-v8, Playwright 1.65 | 커버리지 80% 기준 |

## 구조

```
kids-keyboard/
├─ index.html
├─ src/
│  ├─ main.ts                 # 진입점, 앱 상태 머신 연결
│  ├─ app/
│  │  └─ appState.ts          # 시작 → 놀이 → (일시정지 | 나가기 확인) → 부모 메뉴
│  ├─ input/
│  │  ├─ keymap.ts            # event.code → 숫자/영문/한글 자모/장식 (두벌식 표, Shift 포함)
│  │  ├─ inputFilter.ts       # 자동반복 무시, 초당 생성 제한
│  │  └─ holdDetector.ts      # Ctrl+Alt+P 3초, 모서리 3초 터치 (포커스 잃으면 초기화)
│  ├─ content/
│  │  └─ glyphs.ts            # 글자 → 이모지, 읽는 이름 ("기역", "에이", "일")
│  ├─ render/
│  │  ├─ stage.ts             # 스프라이트 생성·제거, 동시 30개 상한
│  │  └─ effects.ts           # 비눗방울·별·하트
│  ├─ audio/
│  │  ├─ sfx.ts               # 합성 효과음
│  │  └─ speech.ts            # 읽어주기 (새 입력 시 이전 음성 끊기, 음성 없으면 생략)
│  ├─ lock/
│  │  ├─ fullscreen.ts        # 전체화면, Keyboard Lock, Wake Lock, 이탈 감지
│  │  └─ guards.ts            # 브라우저 단축키·우클릭·줌·뒤로가기 차단
│  ├─ settings/
│  │  └─ settingsStore.ts     # 설정 저장/불러오기 + 검증
│  └─ ui/
│     ├─ startScreen.ts       # 시작 버튼, 앱 고정 안내, 음성 유무
│     ├─ hint.ts              # 흐릿한 나가기 안내 문구
│     ├─ holdRing.ts          # 길게 누르기 진행 링
│     ├─ exitConfirm.ts       # 2단계 "나가기" 버튼
│     ├─ pauseOverlay.ts      # 전체화면 풀렸을 때
│     └─ parentMenu.ts        # 설정, 다시 시작
├─ tests/e2e/                 # Playwright
└─ docs/
```

## 단계별 작업

### 0단계 — 기술 검증 스파이크 ✅ 완료 (2026-11-21, 태블릿 제외)
결과: [03-spike-results.md](03-spike-results.md) — 정상 키보드로 취급, 고장 대응 기능 삭제, Windows Keyboard Lock으로 Esc(짧게)·Alt+Tab 차단 확인. 태블릿 측정은 7단계로 이관.

<details><summary>원래 계획</summary>

고장난 키보드의 실제 동작을 모르고 필터 기본값을 정하면 추측이 된다.

- **작업**: `spike/keylog.html` 한 장짜리 페이지. 키를 누를 때마다 `code`, `key`, `repeat`, keydown/keyup 시각, 같은 키의 직전 입력과의 간격(ms)을 표로 보여 주고 CSV로 복사.
  - 전체화면 버튼 + `navigator.keyboard.lock()` 시도 결과 표시 (Windows에서 Alt+Tab·Win·Esc 확인)
  - `speechSynthesis.getVoices()` 목록 표시 (한국어 음성 유무)
- **실행**: PC는 `localhost`, 태블릿은 같은 와이파이에서 PC 주소로 접속 (`vite --host`)
- **측정할 것**: 채터링 간격 분포 → FR-12 기본값(현재 가정 120ms) 결정 / 태블릿에서 `event.code`가 정상인지 / Ctrl+Alt+P를 3초 누를 때 키업이 끼어드는 간격 → FR-34 유예값(가정 300ms) 결정
- **완료 기준**: 측정 결과를 `docs/03-spike-results.md`에 기록하고 기본값 확정

</details>

### 1단계 — 프로젝트 뼈대
- Vite + TS 프로젝트, Vitest(jsdom), Playwright, ESLint, Prettier 설정
- `git init` (현재 git 저장소 아님), `.gitignore`에 `spike/results/` 추가 (측정 원본에 기기 정보가 들어 있어 커밋하지 않음)
- **검증**: `npm run build`, `npm test`, `npm run lint` 모두 통과

### 2단계 — 핵심 로직 (TDD, 화면 없음)
테스트를 먼저 쓰고(RED) 구현한다(GREEN).

| 작업 | 대표 테스트 |
|------|------------|
| `keymap.ts` | `KeyR` → 영문 R / 자모 ㄱ, `Shift+KeyR` → ㄲ, `Digit3`·`Numpad3` → 3, `Space` → 장식, 모드별 출력 |
| `inputFilter.ts` | `repeat` 무시 / 같은 키를 빠르게(128ms) 연타해도 모두 통과 / 초당 11번째 버림 / 1초 지나면 다시 허용 |
| `holdDetector.ts` | 3초 유지 시 발동 / 2.9초에 떼면 미발동 / 키 하나라도 떼면 리셋 / 키 하나라도 빠지면 미발동 / 포커스 잃으면 리셋 / 모서리 영역 밖으로 손가락이 나가면 리셋 |
| `glyphs.ts` | 모든 자모·영문·숫자에 이름과 이모지가 빠짐없이 있는지 |
| `settingsStore.ts` | 저장/복원 / 깨진 값·없는 값 → 기본값 / 저장소 접근 예외 시에도 동작 |
| `appState.ts` | 상태 전이: 시작→놀이, 놀이→나가기확인(3초)→부모메뉴, 확인 5초 초과→놀이, 전체화면 이탈→일시정지 |

- **검증**: `npm test -- --coverage` → 핵심 로직 커버리지 90% 이상 목표 (전체 80% 이상)
- ✅ **완료 (2026-11-21)**: 테스트 172개, 줄 커버리지 99%. 코드 리뷰(HIGH 2·MEDIUM 일부) 반영 — 놓친 Ctrl/Alt keyup 자동 보정, 나가기 확인의 5초 제한을 확인 시점에도 적용, 모서리 판정 경계, `getSafeStorage`, 잘못된 상한값 방어

#### 3·5단계에서 지킬 통합 규칙 (2단계 코드 리뷰에서 나옴)
1. **키 이벤트 처리 순서**: ① 눌린 키 추적(`updatePressedKeys`)과 나가기 판정(`updateHold`)은 **모든 원시 이벤트**에 먼저 → ② `mapKey` → ③ `acceptInput`은 결과가 `glyphs`/`decor`일 때만. (수식키가 초당 상한을 잡아먹거나, 상한에 걸린 키가 나가기 판정에서 빠지는 것 방지)
2. **나가기 상태는 하나로**: `HoldState` 하나에 `active = 키 조합 || 모서리 터치`. 두 입력이 서로를 리셋하지 않게.
3. **모서리 터치는 손가락별로 추적**: `pointerId → 모서리 안인지` 맵을 두고 `active = 하나라도 모서리 안`. `pointercancel`·`lostpointercapture`도 손 뗀 것으로 처리.
4. **초기화 시점**: `blur`, `visibilitychange`(hidden), `fullscreenchange`(해제) 때 눌린 키를 `NO_KEYS`, 나가기 상태를 `HOLD_IDLE`로.
5. **`preventDefault`는 `ignore`여도 항상** (잠금 중). `mapKey`가 무시하는 Ctrl/Alt 조합이 브라우저 단축키로 새지 않게.
6. **시계 통일**: `acceptInput`·`updateHold`·`reduceApp`의 `now`는 모두 `performance.now()`.
7. **`localStorage`는 `getSafeStorage()`로만 접근.**

#### 3단계 코드 리뷰에서 5·7단계로 넘긴 것
- **`preventDefault` 연결(규칙 5)과 규칙 1~4의 연결은 5단계에서 나가기 흐름과 함께** 한다. 나가기 방법 없이 키만 막으면 부모가 빠져나올 길이 없어지기 때문.
- 설정은 지금 시작할 때 한 번 읽는다 → 5단계 부모 메뉴에서 바꾸면 바로 반영되도록 `getSettings`가 최신 값을 돌려주게.
- 7단계 실기기에서 성능 측정: 글자 30개가 큰 그림자와 함께 움직일 때 태블릿 프레임. 느리면 그림자 흐림 줄이기 또는 `will-change`.

### 3단계 — 화면과 놀이
- `stage.ts`: 글자 + 이모지 스프라이트, 랜덤 위치·색, 튀어나옴 → 몇 초 뒤 사라짐, 30개 초과 시 가장 오래된 것 빠르게 제거
- `effects.ts`: 장식 키·터치용 효과
- 터치: 터치 지점에 효과, 우측 상단 80×80px 영역은 제외, 생성 제한은 키 입력과 공유
- `hint.ts`: 흐릿한 안내 문구 (불투명도 15~25%)
- 글자 크기: 화면 높이 20% 이상, Jua 글꼴
- 깜빡임 금지 (초당 3회 이상 번쩍이는 효과 없음)
- **검증**: 통합 테스트(키 이벤트 → DOM에 스프라이트 생성/제거, 상한 유지) + 브라우저에서 눈으로 확인

### 4단계 — 소리
- `sfx.ts`: 글자/장식/터치별 짧은 합성음 (뽁, 띠링 등), 음량 설정, 동시 재생 수 제한
- `speech.ts`: 새 입력이 오면 `speechSynthesis.cancel()` 후 읽기 / ko-KR 음성 없으면 생략 / 시작 버튼 탭 시 오디오 잠금 해제
- **검증**: 음성 API를 가짜로 바꿔 끊기·생략 동작 단위 테스트, 실제 기기에서 듣기

### 5단계 — 잠금과 나가기
- `fullscreen.ts`: 시작 버튼 → 전체화면 → (지원 시) Keyboard Lock → Wake Lock. 각각 실패해도 계속 진행하고 상태만 기록
- `guards.ts`: 놀이 중 `keydown` 기본 동작 차단, 우클릭·텍스트 선택·핀치/더블탭 줌·당겨서 새로고침 차단 (`touch-action`, `overscroll-behavior`), 뒤로가기 history 트릭
- 이탈 감지: `fullscreenchange`로 전체화면이 풀리면 일시정지 오버레이
- 나가기: `holdDetector` + 진행 링(1초 뒤부터 표시) → 2단계 확인 버튼(임의 위치, 5초, Enter도 허용) → 전체화면 해제 + 부모 메뉴
- 부모 메뉴: 표시 모드, 대/소문자, 효과음·음량, 읽어주기, 터치 반응, 다시 시작
- **검증**: E2E — 시작 → 키 입력 → 스프라이트 등장 / Ctrl+Alt+P 3초 → 확인 버튼 → 부모 메뉴 / 손바닥 연타 흉내(서로 다른 키 50개 동시) → 화면 객체 30개 이하 유지

### 6단계 — PWA·오프라인·배포
- vite-plugin-pwa: 앱 아이콘, `display: fullscreen`, 가로/세로 모두 허용, 전체 파일 미리 캐시
- **GitHub Pages 배포**: GitHub Actions 워크플로(`.github/workflows/deploy.yml`) 추가, Vite `base`를 저장소 이름 경로(`/<repo>/`)로 설정. 서비스 워커, Wake Lock, Keyboard Lock은 **HTTPS에서만** 동작하는데 GitHub Pages는 HTTPS를 기본 제공
- **검증**: 비행기 모드에서 홈 화면 아이콘으로 실행되는지

### 7단계 — 실기기 검증과 조정
체크리스트를 `docs/04-device-checklist.md`로 만들고 두 환경에서 직접 확인:
- 키보드로 10분 마구 연타 → 화면 폭주 없음, 프레임 유지
- **태블릿 (스파이크에서 미측정)**: `event.code`가 PC와 같은지, 앱 고정 + 전체화면, 뒤로가기/Esc/홈 키 동작, 모서리 나가기, Ctrl+Alt+P 나가기, 한국어 음성 유무
- Windows: **Win 키** 차단 여부 (Esc·Alt+Tab은 스파이크에서 확인됨), Esc 길게 → 일시정지 오버레이
- 읽어주기 음성 유무별 동작
- 1시간 연속 실행 후 메모리 증가 없음

## 의존 관계
```
0 스파이크 ✅
1 뼈대 ──► 2 핵심 로직 ──► 3 화면 ──► 4 소리
                     └────► 5 잠금·나가기 (3과 병행 가능)
3·4·5 ──► 6 PWA·배포 ──► 7 실기기 검증
```

## 리스크

| 리스크 | 가능성 | 대응 |
|--------|:------:|------|
| 태블릿에서 HTTPS 없이 접속하면 오프라인·Wake Lock이 안 됨 | 높음 | 6단계에서 HTTPS 정적 호스팅에 배포. 개발 중에는 LAN http로 키 입력만 테스트 |
| Windows Keyboard Lock이 기대보다 적게 막음 | 낮음 | 스파이크에서 Esc(짧게)·Alt+Tab 차단 확인. Win 키만 7단계에서 확인 |
| 태블릿에서 키 값이 PC와 다르게 들어옴 | 중 | 스파이크 미측정. 3단계 화면이 나오면 LAN으로 태블릿에서 바로 확인 |
| 갤럭시 태블릿에서 DOM 애니메이션이 버벅임 | 낮음 | transform/opacity만 사용, 상한 30개. 그래도 느리면 Canvas로 교체 (render 모듈만 바꾸면 되도록 분리) |
| 기기별 이모지 모양 차이 | 낮음 | 수용 (이모지는 MVP용, 나중에 그림 교체 가능하게 분리) |
| Jua 한글 글꼴 용량 | 낮음 | fontsource의 유니코드 범위별 분할 파일 사용, 필요한 범위만 캐시 |
| 전체화면·Keyboard Lock은 자동 테스트로 검증 불가 | 확정 | 7단계 수동 체크리스트로 보완 |

## 결정 사항 (2026-11-21)
1. **배포 위치** — ✅ **사용자 GitHub에 새 저장소를 만들어 GitHub Pages로 배포**
   - 무료 GitHub 계정에서 Pages를 쓰려면 저장소가 **공개(public)**여야 함 (비공개 저장소 Pages는 유료 플랜). 코드에 개인정보가 없으므로 공개해도 무방
   - 배포는 GitHub Actions로 `main` 브랜치에 push하면 자동 빌드·배포
   - 저장소 생성·첫 push는 6단계에서 사용자 확인 후 진행
2. **숫자 읽기** — ✅ **"일·이·삼"** (한자어 수). 0 → "영"
3. ✅ **키보드는 정상 키보드로 취급** — 스파이크 결과, 고장 증상이 사실상 없음 ([03-spike-results.md](03-spike-results.md))

## 예상 작업량
| 단계 | 규모 |
|------|------|
| 0 스파이크 | 작음 (페이지 1장 + 직접 측정) |
| 1 뼈대 | 작음 |
| 2 핵심 로직 | 중간 |
| 3 화면 | 중간 |
| 4 소리 | 작음 |
| 5 잠금·나가기 | 중간 |
| 6 PWA·배포 | 작음 |
| 7 실기기 검증 | 작음~중간 (직접 확인 필요) |

## 완료 기준
- [ ] 요구사항 v1.0의 M 항목 모두 구현
- [ ] `npm test` 통과, 커버리지 80% 이상
- [ ] E2E 핵심 흐름 통과
- [ ] 실기기 체크리스트 두 환경 모두 통과
