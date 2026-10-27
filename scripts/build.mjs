import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(path.join(output, 'data'), { recursive: true });
await cp(path.join(root, 'public'), output, { recursive: true });
const books = (await readdir(path.join(root, 'data'))).filter(name => name.endsWith('.pdf'));
for (const name of books) await cp(path.join(root, 'data', name), path.join(output, 'data', name));
console.log(`Built Daily Blessings with ${books.length} original PDF books in dist/.`);
