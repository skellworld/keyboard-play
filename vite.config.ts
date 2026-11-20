import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

/**
 * GitHub Pages는 https://<사용자>.github.io/<저장소>/ 아래에서 열린다.
 * 배포 워크플로(.github/workflows/deploy.yml)가 저장소 이름으로 BASE_PATH를 넣어 준다.
 */
const base = process.env.BASE_PATH ?? '/';

const BRAND_BACKGROUND = '#fff4e6';

export default defineConfig({
  base,
  server: { port: 5173, strictPort: true },
  plugins: [
    VitePWA({
      // 새 버전은 다음 실행 때 적용된다 (놀이 도중 페이지가 새로고침되어 전체화면이 풀리는 일 없게).
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: '키보드 놀이',
        short_name: '키보드 놀이',
        description: '키를 누르면 숫자·영문·한글 자모가 귀엽게 나타나는 아이용 키보드 놀이',
        lang: 'ko',
        dir: 'ltr',
        start_url: '.',
        scope: '.',
        display: 'fullscreen',
        orientation: 'any',
        background_color: BRAND_BACKGROUND,
        theme_color: BRAND_BACKGROUND,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 앱 전체(글꼴 14개 포함)를 처음 열 때 저장해 두고 오프라인에서 쓴다.
        globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
