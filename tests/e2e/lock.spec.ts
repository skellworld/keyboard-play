import { expect, test, type Page } from '@playwright/test';

const HOLD_MS = 3300;
/** 확인 화면이 뜬 직후 0.5초는 입력을 받지 않으므로 그보다 조금 더 기다린다 */
const ARRIVAL_GRACE_MS = 650;

async function start(page: Page): Promise<void> {
  await page.getByRole('button', { name: '시작하기' }).click();
  await expect(page.locator('.start-screen')).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('시작 화면에서 시작하면 놀이가 시작되고 키에 반응한다', async ({ page }) => {
  await expect(page.locator('.start-screen')).toBeVisible();
  await expect(page.locator('.start-screen')).toContainText('Ctrl + Alt + P');

  await start(page);
  await page.keyboard.press('KeyR');

  await expect(page.locator('.sprite__char').first()).toHaveText('ㄱ');
});

test('Ctrl+Alt+P를 3초 누르면 확인 버튼이 뜨고 Enter로 부모 메뉴가 열린다', async ({ page }) => {
  await start(page);

  await page.keyboard.down('Control');
  await page.keyboard.down('Alt');
  await page.keyboard.down('KeyP');
  await expect(page.locator('.hold-ring')).toBeVisible();
  await page.waitForTimeout(HOLD_MS);
  await expect(page.locator('.exit-confirm')).toBeVisible();
  await page.keyboard.up('KeyP');
  await page.keyboard.up('Alt');
  await page.keyboard.up('Control');
  await expect(page.locator('.exit-confirm')).toContainText('Enter');
  await page.waitForTimeout(ARRIVAL_GRACE_MS);

  await page.keyboard.press('Enter');

  await expect(page.locator('.parent-menu')).toBeVisible();
});

test('오른쪽 위 모서리를 3초 누르고 나가기를 누르면 부모 메뉴가 열린다', async ({ page }) => {
  await start(page);
  const width = page.viewportSize()?.width ?? 1280;

  await page.mouse.move(width - 10, 10);
  await page.mouse.down();
  await page.waitForTimeout(HOLD_MS);
  await page.mouse.up();
  await page.waitForTimeout(ARRIVAL_GRACE_MS);
  await page.getByRole('button', { name: '나가기' }).click();

  await expect(page.locator('.parent-menu')).toBeVisible();
});

test('모서리로 나가기를 했을 때는 Enter를 눌러도 나가지지 않는다 (아이 보호)', async ({ page }) => {
  await start(page);
  const width = page.viewportSize()?.width ?? 1280;

  await page.mouse.move(width - 10, 10);
  await page.mouse.down();
  await page.waitForTimeout(HOLD_MS);
  await page.mouse.up();
  await page.waitForTimeout(ARRIVAL_GRACE_MS);
  await page.keyboard.press('Enter');

  await expect(page.locator('.exit-confirm')).toBeVisible();
  await expect(page.locator('.parent-menu')).toBeHidden();
});

test('확인 버튼을 5초 안에 누르지 않으면 놀이로 돌아간다', async ({ page }) => {
  await start(page);
  const width = page.viewportSize()?.width ?? 1280;

  await page.mouse.move(width - 10, 10);
  await page.mouse.down();
  await page.waitForTimeout(HOLD_MS);
  await page.mouse.up();
  await expect(page.locator('.exit-confirm')).toBeVisible();

  await expect(page.locator('.exit-confirm')).toBeHidden({ timeout: 7000 });
  await expect(page.locator('.parent-menu')).toBeHidden();
});

test('부모 메뉴에서 바꾼 설정이 다시 놀기에 바로 반영된다', async ({ page }) => {
  await page.getByRole('button', { name: '설정' }).click();
  await page.getByLabel('숫자 + 영어').check();
  await page.getByRole('button', { name: '다시 놀기' }).click();
  await expect(page.locator('.parent-menu')).toBeHidden();

  await page.keyboard.press('KeyR');

  await expect(page.locator('.sprite__char').first()).toHaveText('R');
});
