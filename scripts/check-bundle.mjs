import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(path) : path.endsWith('.js') ? [path] : [];
  }));
  return groups.flat();
}

const files = await javascriptFiles('dist');
if (files.length === 0) throw new Error('No built JavaScript found');
let total = 0;
for (const file of files) total += gzipSync(await readFile(file)).length;
console.log(`All built JavaScript (including service worker): ${total} bytes gzip / 150000-byte budget`);
if (total >= 150_000) throw new Error('JavaScript budget exceeded');
