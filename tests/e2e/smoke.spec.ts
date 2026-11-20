import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('앱 제목과 부모 안내 문구가 있다', async ({ page }) => {
  await expect(page.getByRole('heading', { name: '키보드 놀이' })).toHaveCount(1);
  await expect(page.locator('.parent-hint')).toContainText('Ctrl + Alt + P');
});

test('키를 누르면 한글 자모와 그림이 나타난다', async ({ page }) => {
  await page.keyboard.press('KeyR');

  const sprite = page.locator('.sprite--glyph').first();
  await expect(sprite.locator('.sprite__char')).toHaveText('ㄱ');
  await expect(sprite.locator('.sprite__emoji')).toHaveText('🐻');
});

test('화면을 누르면 그 자리에 효과가 나타난다', async ({ page }) => {
  await page.mouse.click(300, 300);

  await expect(page.locator('.sprite--burst')).toHaveCount(1);
});

test('손바닥으로 마구 눌러도 화면의 객체는 30개를 넘지 않는다', async ({ page }) => {
  const codes = 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('').map((c) => `Key${c}`);
  for (let round = 0; round < 6; round += 1) {
    for (const code of codes) {
      await page.keyboard.press(code);
    }
  }

  // 밀려나며 사라지는 중인 스프라이트는 제외 (상한 자체는 stage 단위 테스트가 maxSprites로 검증)
  expect(await page.locator('.sprite:not(.sprite--leaving)').count()).toBeLessThanOrEqual(30);
});
