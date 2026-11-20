import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __audio: { oscillators: number; clipStarts: number; spoken: string[] };
  }
}

/** 기역 → ae30-c5ed.ogg, 삼 → c0bc.ogg (src/audio/voiceClips.ts voiceClipFile) */
const GIYEOK_CLIP = 'ae30-c5ed.ogg';
const SAM_CLIP = 'c0bc.ogg';

async function startWithAudioSpies(page: Page): Promise<string[]> {
  // 실제 브라우저 API를 감싸서 무엇이 재생·낭독되는지 기록한다.
  await page.addInitScript(() => {
    window.__audio = { oscillators: 0, clipStarts: 0, spoken: [] };
    const createOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function patched(this: AudioContext) {
      window.__audio.oscillators += 1;
      return createOscillator.call(this);
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function patched(
      this: AudioBufferSourceNode,
      ...args: Parameters<AudioBufferSourceNode['start']>
    ) {
      window.__audio.clipStarts += 1;
      return start.apply(this, args);
    };
    // 기기 음성(대체 수단)이 쓰였는지 기록한다. 테스트용 Chrome에는 한국어 음성이 없을 수 있어 가짜를 넣는다.
    class FakeUtterance {
      lang = '';
      voice: SpeechSynthesisVoice | null = null;
      rate = 1;
      pitch = 1;
      volume = 1;
      constructor(public text: string) {}
    }
    window.SpeechSynthesisUtterance = FakeUtterance as unknown as typeof SpeechSynthesisUtterance;
    speechSynthesis.getVoices = () =>
      [{ name: 'Test Korean', lang: 'ko-KR', localService: true }] as SpeechSynthesisVoice[];
    speechSynthesis.speak = (utterance: SpeechSynthesisUtterance) => {
      window.__audio.spoken.push(utterance.text);
    };
  });
  const voiceRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/voice/')) {
      voiceRequests.push(request.url());
    }
  });
  await page.goto('/');
  await page.getByRole('button', { name: '시작하기' }).click();
  return voiceRequests;
}

test('키를 누르면 효과음과 함께 MeloTTS 음성 파일로 글자 이름을 읽어 준다', async ({ page }) => {
  const voiceRequests = await startWithAudioSpies(page);

  await page.keyboard.press('KeyR');
  await expect.poll(() => page.evaluate(() => window.__audio.clipStarts)).toBe(1);
  await page.keyboard.press('Digit3');
  await expect.poll(() => page.evaluate(() => window.__audio.clipStarts)).toBe(2);

  expect(voiceRequests.some((url) => url.endsWith(GIYEOK_CLIP))).toBe(true);
  expect(voiceRequests.some((url) => url.endsWith(SAM_CLIP))).toBe(true);
  expect(await page.evaluate(() => window.__audio.oscillators)).toBeGreaterThanOrEqual(2);
  expect(await page.evaluate(() => window.__audio.spoken)).toEqual([]);
});

test('음성 파일을 못 받으면 기기 음성으로 대신 읽는다', async ({ page }) => {
  await page.route('**/voice/*.ogg', (route) => route.fulfill({ status: 404, body: '' }));
  await startWithAudioSpies(page);

  await page.keyboard.press('KeyR');

  await expect.poll(() => page.evaluate(() => window.__audio.spoken)).toEqual(['기역']);
});

test('화면을 누르면 반짝이는 소리만 나고 읽지는 않는다', async ({ page }) => {
  await startWithAudioSpies(page);

  await page.mouse.click(300, 300);

  await expect.poll(() => page.evaluate(() => window.__audio.oscillators)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__audio.clipStarts)).toBe(0);
  expect(await page.evaluate(() => window.__audio.spoken)).toEqual([]);
});
