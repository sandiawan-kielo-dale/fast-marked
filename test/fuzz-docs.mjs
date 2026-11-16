// Mutation fuzz: take real practice docs and mutate them, compare vs marked.
// Usage: node test/fuzz-docs.mjs [count] [seed]
import { readFileSync } from 'node:fs';
import { parse as fastParse } from '../parse.js';
import { marked } from '../../markdown-render-speed-02-kit/baselines/vendor/marked/marked.esm.js';

const N = Number(process.argv[2] ?? 120);
let seed = Number(process.argv[3] ?? 99);
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const kit = new URL('../../markdown-render-speed-02-kit/', import.meta.url);
const cases = JSON.parse(readFileSync(new URL('practice/input/cases.json', kit), 'utf8'));
const docs = cases.filter((c) => c.id.startsWith('doc-')).map((c) => c.markdown);
const INSERTS = ['*', '**', '_', '__', '~~', '`', '``', '[', ']', '(', ')', '<', '>', '!', '|', '&', '\\*', '@', 'www.x.com', 'http://a.b', 'user@x.io', 'mailto:u@v.w', '#', '## ', '> ', '- ', '1. ', '---', '```', '  \n', ' ', 'é', '\t', 'a_b', 'foo*bar', '~x~', '***', '[a](b)', '![i](u)', '<div>', 'x@y', 'ftp://z.q', 'xmpp:a@b.c'];
const OPS = ['insert', 'delete', 'dup-line', 'swap-lines', 'truncate', 'replace-char'];

function mutate(doc) {
  const lines = doc.split('\n');
  const op = pick(OPS);
  if (op === 'insert') {
    const i = Math.floor(rnd() * (lines.length + 1));
    lines.splice(i, 0, pick(INSERTS) + ' ' + pick(INSERTS));
  } else if (op === 'delete' && lines.length > 2) {
    lines.splice(Math.floor(rnd() * lines.length), 1);
  } else if (op === 'dup-line' && lines.length > 0) {
    const i = Math.floor(rnd() * lines.length);
    lines.splice(i, 0, lines[i]);
  } else if (op === 'swap-lines' && lines.length > 2) {
    const a = Math.floor(rnd() * lines.length), b = Math.floor(rnd() * lines.length);
    [lines[a], lines[b]] = [lines[b], lines[a]];
  } else if (op === 'truncate') {
    return doc.slice(0, Math.floor(rnd() * doc.length));
  } else if (op === 'replace-char') {
    const i = Math.floor(rnd() * doc.length);
    return doc.slice(0, i) + pick(INSERTS) + doc.slice(i + 1);
  }
  return lines.join('\n');
}

let fails = 0, checked = 0;
for (let i = 0; i < N; i++) {
  const doc = mutate(pick(docs));
  checked++;
  let fast, ref;
  try { fast = fastParse(doc); } catch (e) { fast = 'THREW:' + e.message; }
  try { ref = marked.parse(doc); } catch (e) { ref = 'THREW:' + e.message; }
  if (fast !== ref) {
    fails++;
    if (fails <= 3) {
      console.log('=== MISMATCH #' + fails + ' (len ' + doc.length + ') ===');
      // find first differing position
      let j = 0;
      while (j < Math.min(fast.length, ref.length) && fast[j] === ref[j]) j++;
      console.log('first diff at', j, 'context:', JSON.stringify(doc.slice(Math.max(0, j - 200), j + 200)));
      console.log('fast :', JSON.stringify(fast.slice(Math.max(0, j - 80), j + 120)));
      console.log('marked:', JSON.stringify(ref.slice(Math.max(0, j - 80), j + 120)));
    }
  }
}
console.log(`doc-mutation fuzz: ${checked} docs, ${fails} mismatches`);
