# 글자 이름 음성 만들기 (MeloTTS)

앱이 읽어 주는 글자 이름("기역", "에이", "삼" …)은 [MeloTTS](https://github.com/myshell-ai/MeloTTS)
(MIT, 한국어 `KR` 목소리)로 **PC에서 미리 만든 음성 파일**(`public/voice/*.ogg`)이다.
MeloTTS는 PyTorch로 돌아가는 Python 프로그램이라 태블릿·브라우저에서는 실행할 수 없다.
파일이 없거나 재생에 실패하면 앱은 기기 내장 음성으로 대신 읽는다.

이 폴더의 Python 환경(`.venv`, `.uv-tool`, `.mecab-ko` …)은 git에 올리지 않는다.
글자 표(`src/content/glyphs.ts`)의 읽는 말을 바꿨을 때만 아래를 다시 하면 된다.

## 다시 만들기

PowerShell, 이 폴더(`tools/tts`)에서:

```powershell
cd ..\..; npm run voice:texts; cd tools\tts
.\.venv\Scripts\python.exe generate_voice.py           # 없는 파일만
.\.venv\Scripts\python.exe generate_voice.py --force   # 모두 다시
```

옵션: `--speed 0.85`(기본, 조금 느리게) · `--limit 5`(앞 5개만 시험) · `--out out\test`(다른 폴더로).

## 처음 한 번: 환경 만들기 (Windows)

MeloTTS는 Ubuntu·Python 3.9에서만 공식 시험되었다. Windows에서는 아래 순서로 동작을 확인했다 (2026-11).
**명령은 Claude 앱의 샌드박스가 아닌 일반 PowerShell 창에서** 실행한다 (샌드박스에서는 uv가 폴더를 옮기지 못한다).

```powershell
py -3.12 -m venv .uv-tool
.\.uv-tool\Scripts\python.exe -m pip install uv
.\.uv-tool\Scripts\uv.exe venv --python 3.10 .venv
.\.uv-tool\Scripts\uv.exe pip install --python .venv\Scripts\python.exe git+https://github.com/myshell-ai/MeloTTS.git
.\.uv-tool\Scripts\uv.exe pip install --python .venv\Scripts\python.exe "setuptools<80"
.\.venv\Scripts\python.exe -m unidic download
.\.uv-tool\Scripts\uv.exe pip install --target .mecab-ko --python-platform windows --python-version 3.10 python-mecab-ko
```

| 단계                                   | 이유                                                                                                                                                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Python 3.10                            | MeloTTS가 고정한 옛 라이브러리(transformers 4.27 등)가 3.12와 맞지 않음                                                                                                                                                                                                     |
| `setuptools<80`                        | MeloTTS가 쓰는 librosa 0.9가 `pkg_resources`를 씀                                                                                                                                                                                                                           |
| `unidic download` (약 526MB)           | 한국어만 써도 MeloTTS가 시작할 때 일본어 사전을 불러옴                                                                                                                                                                                                                      |
| `python-mecab-ko`를 `.mecab-ko`에 따로 | g2pkk(한국어 발음 변환)가 Windows에서 찾는 `eunjeon`은 C++ 빌드 도구가 있어야 설치됨. 대신 미리 빌드된 python-mecab-ko를 [eunjeon.py](eunjeon.py) 어댑터로 연결. site-packages에 함께 두면 Windows가 폴더 이름 대소문자를 구분하지 않아 일본어 `MeCab/`과 섞여 둘 다 망가짐 |

처음 실행할 때 HuggingFace에서 언어 모델(약 1.5GB, `C:\Users\<사용자>\.cache\huggingface`)을 내려받는다.
