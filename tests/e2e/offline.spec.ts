import { expect, test } from '@playwright/test';

interface ManifestIcon {
  src: string;
  sizes: string;
  purpose?: string;
}

test('한 번 열고 나면 인터넷 없이도 열리고 놀 수 있다', async ({ page, context }) => {
  await page.goto('/');
  // 서비스 워커가 파일을 모두 저장할 때까지 기다린다.
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    return registration.active?.state;
  });

  await context.setOffline(true);
  await page.reload();

  await page.getByRole('button', { name: '시작하기' }).click();
  await page.keyboard.press('KeyR');
  await expect(page.locator('.sprite__char').first()).toHaveText('ㄱ');
});

test('홈 화면에 추가하면 전체화면 앱으로 열리는 앱 정보가 있다', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();

  const manifest = await (await request.get(new URL(href ?? '', page.url()).toString())).json();

  expect(manifest.name).toBe('키보드 놀이');
  expect(manifest.display).toBe('fullscreen');
  expect(manifest.lang).toBe('ko');
  const icons = manifest.icons as ManifestIcon[];
  expect(icons.some((icon) => icon.sizes === '192x192')).toBe(true);
  expect(icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable')).toBe(true);
});
