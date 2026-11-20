import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __audio: { oscillators: number; spoken: string[]; voice: string | null };
  }
}

test.beforeEach(async ({ page }) => {
  // 실제 브라우저 API를 감싸서 무엇이 재생·낭독되는지 기록한다.
  // 테스트용 Chrome에는 한국어 음성이 없을 수 있어 가짜 한국어 음성 하나를 끼워 넣는다.
  await page.addInitScript(() => {
    window.__audio = { oscillators: 0, spoken: [], voice: null };
    const createOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function patched(this: AudioContext) {
      window.__audio.oscillators += 1;
      return createOscillator.call(this);
    };
    const fakeKorean = {
      name: 'Test Korean',
      lang: 'ko-KR',
      localService: true,
      default: true,
      voiceURI: 'test-ko',
    } as SpeechSynthesisVoice;
    // 진짜 SpeechSynthesisUtterance는 가짜 음성 객체를 voice에 넣으면 타입 오류를 낸다.
    class FakeUtterance {
      lang = '';
      voice: SpeechSynthesisVoice | null = null;
      rate = 1;
      pitch = 1;
      volume = 1;
      constructor(public text: string) {}
    }
    window.SpeechSynthesisUtterance = FakeUtterance as unknown as typeof SpeechSynthesisUtterance;
    speechSynthesis.getVoices = () => [fakeKorean];
    speechSynthesis.speak = (utterance: SpeechSynthesisUtterance) => {
      window.__audio.spoken.push(utterance.text);
      window.__audio.voice = utterance.voice?.name ?? null;
    };
  });
  await page.goto('/');
});

test('키를 누르면 효과음이 나고 글자 이름을 읽어 준다', async ({ page }) => {
  await page.keyboard.press('KeyR');
  await page.keyboard.press('Digit3');

  await expect.poll(() => page.evaluate(() => window.__audio.spoken)).toEqual(['기역', '삼']);
  expect(await page.evaluate(() => window.__audio.voice)).toBe('Test Korean');
  expect(await page.evaluate(() => window.__audio.oscillators)).toBeGreaterThanOrEqual(2);
});

test('화면을 누르면 반짝이는 소리만 나고 읽지는 않는다', async ({ page }) => {
  await page.mouse.click(300, 300);

  await expect.poll(() => page.evaluate(() => window.__audio.oscillators)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__audio.spoken)).toEqual([]);
});
