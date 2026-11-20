import { expect, test } from '@playwright/test';

test('앱이 로드되고 제목이 보인다', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '키보드 놀이' })).toBeVisible();
});
