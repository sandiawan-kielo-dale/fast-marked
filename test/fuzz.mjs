// Differential fuzz: random markdown-ish strings, my parse.js vs real marked.
// Usage: node test/fuzz.mjs [count] [seed]
import { parse as fastParse } from '../parse.js';
import { marked } from '../../markdown-render-speed-02-kit/baselines/vendor/marked/marked.esm.js';

const N = Number(process.argv[2] ?? 3000);
let seed = Number(process.argv[3] ?? 12345);
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const WORDS = ['foo', 'bar', 'baz', 'hello', 'world', 'a', 'b', 'x', 'www.', 'http', 'https', 'ftp', 'mailto:', 'xmpp:', 'example', 'com', 'org', 'user', 'link', 'text', 'code', 'em', 'strong', 'del', 'table', 'cell', 'item'];
const TOKS = [' ', '  ', '   ', '\n', '\n\n', '*', '**', '_', '__', '~~', '`', '``', '```', '#', '##', '>', '-', '+', '1.', '[', ']', '(', ')', '<', '>', '!', '|', '&', '&amp;', '&#65;', '\\', '\\*', '\\_', '~', '@', '.', ',', ':', '/', 'www.example.com', 'http://example.com', 'https://x.org', 'ftp://a.b', 'user@example.com', 'foo@bar', 'a@b.c', 'x@y', 'mailto:a@b.c', ':smile:', '---', '===', '\t', '\r', 'é', '—', '"', "'", '```js\ncode\n```', '[a](b)', '[a][b]', '![a](b)', '<div>', '</div>', '<a href="x">', '***', '___', '____', '*_*', '_*_', 'a *b* c', '# h', '## h2', '> q', '- li', '1. li', '| a | b |', ':-:', '***', '~~x~~', 'a_b', 'foo_bar', 'x_y_z'];
const BLOCKS = ['# Title\n\n', '## Sub\n\n', '> quote text\n\n', '- item one\n- item two\n\n', '1. first\n2. second\n\n', '```\ncode block\n```\n\n', '```js\nlet x = 1;\n```\n\n', '| a | b |\n|---|---|\n| 1 | 2 |\n\n', '---\n\n', 'para with [a link](http://x.com) inside.\n\n'];

function randLine() {
  const n = 1 + Math.floor(rnd() * 14);
  let s = '';
  for (let i = 0; i < n; i++) s += rnd() < 0.5 ? pick(WORDS) : pick(TOKS);
  return s;
}
function randDoc() {
  const n = 1 + Math.floor(rnd() * 4);
  let s = '';
  for (let i = 0; i < n; i++) {
    if (rnd() < 0.25) s += pick(BLOCKS);
    else s += randLine() + (rnd() < 0.6 ? '\n' : ' ');
  }
  return s;
}

let fails = 0;
const seen = new Set();
for (let i = 0; i < N; i++) {
  const doc = randDoc();
  if (seen.has(doc)) continue;
  seen.add(doc);
  let fast, ref;
  try { fast = fastParse(doc); } catch (e) { fast = 'THREW:' + e.message; }
  try { ref = marked.parse(doc); } catch (e) { ref = 'THREW:' + e.message; }
  if (fast !== ref) {
    fails++;
    if (fails <= 5) {
      console.log('=== MISMATCH #' + fails + ' ===');
      console.log('input:', JSON.stringify(doc));
      console.log('fast :', JSON.stringify(fast));
      console.log('marked:', JSON.stringify(ref));
    }
  }
}
console.log(`fuzz: ${seen.size} unique docs, ${fails} mismatches`);
