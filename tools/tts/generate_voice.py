"""MeloTTS(한국어 KR 목소리)로 글자 이름 음성 파일을 만든다.

입력: tools/tts/texts.json   (npm run voice:texts 로 앱의 글자 표에서 만든다)
출력: public/voice/<file>.ogg (Opus, 24kHz 모노, 앞뒤 무음 제거, 음량 맞춤)

실행 (tools/tts 폴더에서):
  .venv\\Scripts\\python.exe generate_voice.py                 # 없는 파일만 만든다
  .venv\\Scripts\\python.exe generate_voice.py --force         # 모두 다시 만든다
  .venv\\Scripts\\python.exe generate_voice.py --limit 5       # 앞의 5개만 (시험용)
  .venv\\Scripts\\python.exe generate_voice.py --only 기역 아  # 지정한 문장만
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
DEFAULT_TEXTS = HERE / "texts.json"
DEFAULT_OUT = ROOT / "public" / "voice"

TARGET_RATE = 24_000  # Opus가 지원하는 샘플레이트, 말소리에 충분하고 파일이 작다
DEFAULT_SPEED = 0.85  # 아이에게 또박또박 들리도록 조금 느리게
PEAK_DBFS = -3.0  # 모든 파일의 최대 음량을 같게 맞춘다
TRIM_TOP_DB = 35  # 앞뒤 무음으로 볼 기준
PAD_SECONDS = 0.04  # 잘린 소리 앞뒤에 남길 아주 짧은 여유


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="MeloTTS로 글자 이름 음성 파일 만들기")
    parser.add_argument("--texts", type=Path, default=DEFAULT_TEXTS)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--speed", type=float, default=DEFAULT_SPEED)
    parser.add_argument("--device", default="cpu", help="cpu 또는 cuda")
    parser.add_argument("--force", action="store_true", help="이미 있는 파일도 다시 만든다")
    parser.add_argument("--only", nargs="*", default=None, help="이 문장들만 만든다")
    parser.add_argument("--limit", type=int, default=None, help="앞에서부터 이 개수만 만든다")
    return parser.parse_args()


def load_items(path: Path, only: list[str] | None, limit: int | None) -> list[dict[str, str]]:
    items = json.loads(path.read_text(encoding="utf-8"))
    valid = isinstance(items, list) and all(
        isinstance(i, dict) and isinstance(i.get("text"), str) and is_plain_ogg_name(i.get("file"))
        for i in items
    )
    if not valid:
        raise ValueError(f"{path} 형식이 올바르지 않습니다 (npm run voice:texts 로 다시 만드세요)")
    if only:
        wanted = set(only)
        items = [item for item in items if item["text"] in wanted]
    if limit is not None:
        items = items[: max(0, limit)]
    return items


def is_plain_ogg_name(name: object) -> bool:
    """폴더 이동 없는 'xxxx.ogg' 이름만 허용한다 (--out 밖으로 쓰는 일 방지)."""
    return isinstance(name, str) and name.endswith(".ogg") and Path(name).name == name


def write_atomically(target: Path, clip: np.ndarray) -> None:
    """임시 파일에 다 쓴 뒤 이름을 바꾼다. 중간에 멈춰도 깨진 파일이 남지 않는다."""
    temporary = target.with_name(f"{target.stem}.part.ogg")
    sf.write(temporary, clip, TARGET_RATE, format="OGG", subtype="OPUS")
    os.replace(temporary, target)


def polish(audio: np.ndarray, rate: int) -> np.ndarray:
    """앞뒤 무음을 자르고, 24kHz로 바꾸고, 최대 음량을 맞춘다."""
    trimmed, _ = librosa.effects.trim(audio, top_db=TRIM_TOP_DB)
    if trimmed.size == 0:
        raise ValueError("소리가 없는 결과")
    resampled = librosa.resample(trimmed, orig_sr=rate, target_sr=TARGET_RATE)
    pad = np.zeros(int(PAD_SECONDS * TARGET_RATE), dtype=np.float32)
    padded = np.concatenate([pad, resampled.astype(np.float32), pad])
    peak = float(np.max(np.abs(padded))) or 1.0
    gain = (10 ** (PEAK_DBFS / 20)) / peak
    return (padded * gain).astype(np.float32)


def main() -> int:
    args = parse_args()
    items = load_items(args.texts, args.only, args.limit)
    if not items:
        print("만들 문장이 없습니다.")
        return 1
    args.out.mkdir(parents=True, exist_ok=True)

    from melo.api import TTS  # 무거운 모듈이라 인자 확인 뒤에 불러온다

    model = TTS(language="KR", device=args.device)
    speaker = model.hps.data.spk2id["KR"]
    rate = model.hps.data.sampling_rate

    made = 0
    failed: list[str] = []
    for item in items:
        target = args.out / item["file"]
        if target.exists() and not args.force:
            continue
        try:
            audio = model.tts_to_file(item["text"], speaker, None, speed=args.speed, quiet=True)
            clip = polish(np.asarray(audio, dtype=np.float32), rate)
            write_atomically(target, clip)
        except Exception as error:  # 한 문장이 실패해도 나머지는 계속 만든다
            failed.append(item["text"])
            print(f"실패: {item['text']} ({error})", file=sys.stderr)
            continue
        made += 1
        print(f"{item['text']}\t{target.name}\t{len(clip) / TARGET_RATE:.2f}s")

    print(f"완료: {made}개 만듦 -> {args.out}")
    if failed:
        print(f"실패 {len(failed)}개: {' '.join(failed)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
