// 앱 아이콘 만들기: 아래 SVG 하나로 PNG 아이콘들을 설치된 Chrome(Playwright)으로 그린다.
// 실행: npm run icons  → public/favicon.svg, public/icons/*.png
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const ICON_DIR = path.join(PUBLIC_DIR, 'icons');

/**
 * 크림색 바탕 위 주황 키캡 + 흰 별 + 색 점들.
 * rounded: 둥근 모서리(일반 아이콘) / false: 가장자리까지 채움(안드로이드 maskable, 중앙 80% 안에 그림)
 */
function iconSvg({ rounded }) {
  const background = rounded
    ? '<rect width="512" height="512" rx="112" fill="#fff4e6"/>'
    : '<rect width="512" height="512" fill="#fff4e6"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="cap" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff9a52"/>
      <stop offset="1" stop-color="#ff7a2f"/>
    </linearGradient>
    <radialGradient id="blush" cx="0.82" cy="0.86" r="0.45">
      <stop offset="0" stop-color="#ffe3ec"/>
      <stop offset="1" stop-color="#ffe3ec" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${background}
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#blush)"/>
  <circle cx="132" cy="134" r="14" fill="#2f80ed"/>
  <circle cx="382" cy="130" r="12" fill="#1f9d55"/>
  <circle cx="390" cy="388" r="16" fill="#e84393"/>
  <circle cx="124" cy="384" r="12" fill="#8e44ad"/>
  <rect x="136" y="178" width="240" height="196" rx="48" fill="#e0601c"/>
  <rect x="136" y="150" width="240" height="196" rx="48" fill="url(#cap)"/>
  <polygon fill="#ffffff" points="256,186 272,226 315,229 282,256 293,298 256,275 219,298 230,256 197,229 240,226"/>
</svg>`;
}

const OUTPUTS = [
  { file: 'icons/icon-192.png', size: 192, rounded: true },
  { file: 'icons/icon-512.png', size: 512, rounded: true },
  { file: 'icons/icon-maskable-512.png', size: 512, rounded: false },
  { file: 'icons/apple-touch-icon-180.png', size: 180, rounded: false },
];

async function render(browser, svg, size) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const scaled = svg.replace('width="512" height="512"', `width="${size}" height="${size}"`);
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${scaled}</body></html>`,
  );
  const png = await page.screenshot({ omitBackground: true });
  await page.close();
  return png;
}

await mkdir(ICON_DIR, { recursive: true });
await writeFile(path.join(PUBLIC_DIR, 'favicon.svg'), iconSvg({ rounded: true }));
const browser = await chromium.launch({ channel: 'chrome' });
try {
  for (const output of OUTPUTS) {
    const png = await render(browser, iconSvg(output), output.size);
    await writeFile(path.join(PUBLIC_DIR, output.file), png);
    process.stdout.write(`만듦: public/${output.file}\n`);
  }
} finally {
  await browser.close();
}
