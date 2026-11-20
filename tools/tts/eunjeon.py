"""g2pkk(MeloTTS의 한국어 발음 변환기)가 Windows에서 찾는 'eunjeon' 모듈 대신 쓰는 어댑터.

- eunjeon은 설치할 때 Microsoft C++ Build Tools가 있어야 해서, 미리 빌드된 python-mecab-ko를 쓴다.
- python-mecab-ko는 .mecab-ko 폴더에 따로 설치한다. Windows는 폴더 이름의 대소문자를 구분하지 않아
  site-packages에 함께 두면 MeloTTS가 쓰는 일본어 MeCab 패키지(MeCab/)와 파일이 섞여 둘 다 망가진다.
- g2pkk는 Mecab().pos(text)만 쓰며, python-mecab-ko의 MeCab.pos도 같은 (형태소, 품사) 목록을 돌려준다.

설치: .\\.uv-tool\\Scripts\\uv.exe pip install --target .mecab-ko --python-platform windows
      --python-version 3.10 python-mecab-ko
"""

from __future__ import annotations

import sys
from pathlib import Path

_MECAB_KO_DIR = Path(__file__).resolve().parent / ".mecab-ko"
if not _MECAB_KO_DIR.is_dir():
    raise ImportError(f"python-mecab-ko가 {_MECAB_KO_DIR}에 없습니다. 위 설치 명령을 실행하세요.")
# 맨 뒤에 붙여 site-packages의 다른 패키지를 가리지 않게 한다.
sys.path.append(str(_MECAB_KO_DIR))

from mecab import MeCab as _MeCab  # noqa: E402  (경로를 추가한 뒤에 불러와야 한다)


class Mecab(_MeCab):
    """eunjeon.Mecab과 같은 이름으로 쓸 수 있게 한 python-mecab-ko MeCab."""
