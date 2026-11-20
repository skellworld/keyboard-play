import type { Glyph } from '../input/keymap';

/** 글자 하나를 보여 줄 때 함께 쓰는 정보: 읽어주기 문장과 그림(이모지). */
export interface GlyphInfo {
  readonly speech: string;
  readonly emoji: string;
}

const EMPTY_INFO: GlyphInfo = Object.freeze({ speech: '', emoji: '' });

/** 숫자는 한자어 수로 읽는다 (사용자 결정: 일·이·삼, 0은 영). */
const DIGIT_SPEECH: readonly string[] = [
  '영',
  '일',
  '이',
  '삼',
  '사',
  '오',
  '육',
  '칠',
  '팔',
  '구',
];
const CHICK = '🐥';
const EGG = '🥚';

/** 영문자: 한국어 발음 + 그 글자로 시작하는 영어 단어의 그림 */
const LATIN_INFO: Readonly<Record<string, GlyphInfo>> = {
  A: { speech: '에이', emoji: '🍎' },
  B: { speech: '비', emoji: '🐻' },
  C: { speech: '씨', emoji: '🐱' },
  D: { speech: '디', emoji: '🐶' },
  E: { speech: '이', emoji: '🐘' },
  F: { speech: '에프', emoji: '🐸' },
  G: { speech: '지', emoji: '🍇' },
  H: { speech: '에이치', emoji: '🐴' },
  I: { speech: '아이', emoji: '🍦' },
  J: { speech: '제이', emoji: '🧃' },
  K: { speech: '케이', emoji: '🔑' },
  L: { speech: '엘', emoji: '🦁' },
  M: { speech: '엠', emoji: '🐵' },
  N: { speech: '엔', emoji: '🥜' },
  O: { speech: '오', emoji: '🐙' },
  P: { speech: '피', emoji: '🐷' },
  Q: { speech: '큐', emoji: '👑' },
  R: { speech: '알', emoji: '🐰' },
  S: { speech: '에스', emoji: '⭐' },
  T: { speech: '티', emoji: '🐯' },
  U: { speech: '유', emoji: '☂️' },
  V: { speech: '브이', emoji: '🎻' },
  W: { speech: '더블유', emoji: '🐳' },
  X: { speech: '엑스', emoji: '❌' },
  Y: { speech: '와이', emoji: '🧶' },
  Z: { speech: '제트', emoji: '🦓' },
};

/** 한글 자모: 자음은 이름, 모음은 소리로 읽고, 그 자모로 시작하는 단어의 그림을 붙인다. */
const JAMO_INFO: Readonly<Record<string, GlyphInfo>> = {
  ㄱ: { speech: '기역', emoji: '🐻' }, // 곰
  ㄲ: { speech: '쌍기역', emoji: '🌸' }, // 꽃
  ㄴ: { speech: '니은', emoji: '🦋' }, // 나비
  ㄷ: { speech: '디귿', emoji: '🐿️' }, // 다람쥐
  ㄸ: { speech: '쌍디귿', emoji: '🍓' }, // 딸기
  ㄹ: { speech: '리을', emoji: '🚀' }, // 로켓
  ㅁ: { speech: '미음', emoji: '🐴' }, // 말
  ㅂ: { speech: '비읍', emoji: '🍌' }, // 바나나
  ㅃ: { speech: '쌍비읍', emoji: '🍞' }, // 빵
  ㅅ: { speech: '시옷', emoji: '🦁' }, // 사자
  ㅆ: { speech: '쌍시옷', emoji: '🌱' }, // 싹
  ㅇ: { speech: '이응', emoji: '🥛' }, // 우유
  ㅈ: { speech: '지읒', emoji: '🚲' }, // 자전거
  ㅉ: { speech: '쌍지읒', emoji: '🍜' }, // 짜장면
  ㅊ: { speech: '치읓', emoji: '🧀' }, // 치즈
  ㅋ: { speech: '키읔', emoji: '🐘' }, // 코끼리
  ㅌ: { speech: '티읕', emoji: '🍅' }, // 토마토
  ㅍ: { speech: '피읖', emoji: '🍇' }, // 포도
  ㅎ: { speech: '히읗', emoji: '🐯' }, // 호랑이
  ㅏ: { speech: '아', emoji: '🍦' }, // 아이스크림
  ㅐ: { speech: '애', emoji: '🐛' }, // 애벌레
  ㅑ: { speech: '야', emoji: '⚾' }, // 야구
  ㅒ: { speech: '얘', emoji: '💬' }, // 얘기
  ㅓ: { speech: '어', emoji: '🍢' }, // 어묵
  ㅔ: { speech: '에', emoji: '❄️' }, // 에어컨
  ㅕ: { speech: '여', emoji: '🦊' }, // 여우
  ㅖ: { speech: '예', emoji: '💐' }, // 예쁜 꽃
  ㅗ: { speech: '오', emoji: '🦆' }, // 오리
  ㅛ: { speech: '요', emoji: '🥤' }, // 요구르트
  ㅜ: { speech: '우', emoji: '☂️' }, // 우산
  ㅠ: { speech: '유', emoji: '👻' }, // 유령
  ㅡ: { speech: '으', emoji: '🎵' }, // 음악
  ㅣ: { speech: '이', emoji: '🦷' }, // 이빨
};

export function getGlyphInfo(glyph: Glyph): GlyphInfo {
  switch (glyph.kind) {
    case 'digit':
      return digitInfo(glyph.char);
    case 'latin':
      return LATIN_INFO[glyph.char.toUpperCase()] ?? EMPTY_INFO;
    case 'jamo':
      return JAMO_INFO[glyph.char] ?? EMPTY_INFO;
  }
}

function digitInfo(char: string): GlyphInfo {
  const speech = /^[0-9]$/.test(char) ? DIGIT_SPEECH[Number(char)] : undefined;
  if (speech === undefined) {
    return EMPTY_INFO;
  }
  const value = Number(char);
  return { speech, emoji: value === 0 ? EGG : CHICK.repeat(value) };
}

/**
 * 읽어주기에 쓰이는 모든 문장 (중복 없이: 숫자 → 영문 → 자모 순).
 * MeloTTS 음성 파일을 만들 목록이다 (scripts/export-speech-texts.mjs가 읽는다).
 */
export function allSpeechTexts(): readonly string[] {
  const texts = [
    ...DIGIT_SPEECH,
    ...Object.values(LATIN_INFO).map((info) => info.speech),
    ...Object.values(JAMO_INFO).map((info) => info.speech),
  ];
  return [...new Set(texts)];
}
