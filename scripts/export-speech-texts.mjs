// 앱의 글자 표(src/content/glyphs.ts)에서 읽어줄 문장 목록을 뽑아
// MeloTTS 생성 스크립트가 읽을 tools/tts/texts.json으로 쓴다.
// Node 24는 TypeScript 파일을 타입만 지우고 바로 실행할 수 있다.
// 실행: npm run voice:texts
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { voiceClipFile } from '../src/audio/voiceClips.ts';
import { allSpeechTexts } from '../src/content/glyphs.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'tools', 'tts', 'texts.json');

const items = allSpeechTexts().map((text) => ({ text, file: voiceClipFile(text) }));
await writeFile(OUTPUT, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
process.stdout.write(`문장 ${items.length}개 → tools/tts/texts.json\n`);
