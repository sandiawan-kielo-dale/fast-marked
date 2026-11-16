# fast-marked

[![make.fun · markdown-render-speed-02](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/sandiawan-kielo-dale/fast-marked/rank.svg)](https://make.fun/bounty/markdown-render-speed-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/sandiawan-kielo-dale/fast-marked/reward.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)

A dependency-free JavaScript Markdown renderer, byte-compatible with
[marked](https://github.com/markedjs/marked) 18.1.3 (default options: gfm on,
breaks off, pedantic off) and faster. Built for the make.fun bounty
[markdown-render-speed-02](https://make.fun/bounty/markdown-render-speed-02)
— try make.fun yourself: https://make.fun/r/y5hkb35z

## Usage

```js
import { parse } from './parse.js';
parse('# Hello\n\nAT&T'); // '<h1>Hello</h1>\n<p>AT&amp;T</p>\n'
```

`parse(markdown)` returns exactly the HTML `marked.parse(markdown)` returns
for the same input. No dependencies, no network, Node built-ins only in the
driver (`main.ts`).

## Design

A faithful port of marked 18.1.3's Lexer / Tokenizer / Parser algorithms,
with the token objects removed:

- **Block lexing** produces lightweight block descriptors that keep their
  inline source as a string; inline rendering is deferred until all block
  lexing is done, so link reference definitions are always known, however
  late they appear.
- **Inline rendering** emits HTML directly while scanning, with
  first-character dispatch (backslash, `<`, `[`/`!`, `*`/`_`, backtick, `~`,
  space/newline) and a pre-check so the URL regex only runs where a URL
  could start.
- **Delimiter handling** (emphasis, strong, strikethrough) walks the
  delimiter runs the way marked does, including the rule of three, the
  intraword-underscore guard, and the mask that hides `*`/`_`/`~` inside
  code spans, links, tags, and escapes.
- **Cheap wins**: memoized list regexes, first-character dispatch in the
  list inner loop, a bounded setext-heading gate (the expensive lazy regex
  only runs when a `=+`/`-+` underline exists before the next blank line),
  delimiter runs found with a same-character run regex instead of spreading
  strings into arrays, and no per-token object allocation.

## Verification

- `node test/check.mjs` — byte-identical output vs marked 18.1.3 on the
  720-case practice set (680 spec examples + 40 documents).
- `node test/bench.mjs` — wall-time comparison vs marked on the 40
  documents.
- `node test/fuzz.mjs` — differential fuzzing vs marked on generated
  documents.
- `node test/fuzz-docs.mjs` — differential fuzzing vs marked on mutated
  README-style documents.

## License

MIT — see [LICENSE](LICENSE).
