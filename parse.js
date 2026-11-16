// fast-marked: a dependency-free Markdown renderer, byte-compatible with
// marked 18.1.3 (default options: gfm on, breaks off, pedantic off).
// A faithful port of marked's Lexer/Tokenizer/Parser algorithms with the
// token objects removed: inline rendering emits HTML directly while
// scanning, and block lexing defers inline rendering until all link
// reference definitions are known. parse(markdown) -> HTML string.
// MIT License. Copyright (c) 2026 Sandiawan Kielo Dale.

// ---------- regex builder (same semantics as marked's) ----------
function rx(a, e = '') {
  let t = typeof a === 'string' ? a : a.source;
  const n = {
    replace(s, r) {
      let o = typeof r === 'string' ? r : r.source;
      o = o.replace(/(^|[^\[])\^/g, '$1');
      t = t.replace(s, o);
      return n;
    },
    getRegex: () => new RegExp(t, e),
  };
  return n;
}
// Memoizer for the indented block regexes: index clamped to 0..3.
function memo(a) {
  const e = [];
  return (t) => {
    const n = Math.max(0, Math.min(3, t - 1));
    return e[n] || (e[n] = a(n));
  };
}

// ---------- helpers ----------
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s, encode) {
  if (encode) {
    if (/[&<>"']/.test(s)) return s.replace(/[&<>"']/g, (m) => ESC[m]);
  } else if (/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/.test(s)) {
    return s.replace(/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, (m) => ESC[m]);
  }
  return s;
}
function unesc(s) {
  if (/&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/.test(s)) {
    return s.replace(/&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, (m, d, h) => {
      if (d === undefined && h === undefined) return '&amp;';
      const n = d === undefined ? parseInt(h, 16) : parseInt(d, 10);
      if (n === 0 || n > 1114111 || (n >= 55296 && n <= 57343)) return '\uFFFD';
      return n === 38 ? '&amp;' : String.fromCodePoint(n);
    });
  }
  return s;
}
function encURI(s) {
  try { return encodeURI(s).replace(/%25/g, '%'); } catch { return null; }
}
// Split a table row on unescaped pipes, trim cells, pad/truncate to count.
function splitCells(s, count) {
  const t = s.replace(/\|/g, (m, o, str) => {
    let back = false, p = o;
    while (--p >= 0 && str[p] === '\\') back = !back;
    return back ? '|' : ' |';
  });
  const cells = t.split(/ \|/);
  let i = 0;
  if (cells[0].trim() || cells.shift(), cells.length > 0 && !cells[cells.length - 1]?.trim() && cells.pop(), count) {
    if (cells.length > count) cells.splice(count);
    else while (cells.length < count) cells.push('');
  }
  for (; i < cells.length; i++) cells[i] = cells[i].trim().replace(/\\\|/g, '|');
  return cells;
}
// Trim trailing chars: equal to ch (not=false) or not equal (not=true).
function rtrim(s, ch, not) {
  const n = s.length;
  if (n === 0) return '';
  let k = 0;
  for (; k < n;) {
    const c = s.charAt(n - k - 1);
    if (c === ch && !not) k++;
    else if (c !== ch && not) k++;
    else break;
  }
  return s.slice(0, n - k);
}
// Drop trailing blank lines when there are 2+ of them.
function trimBlanks(s) {
  const lines = s.split('\n');
  let t = lines.length - 1;
  for (; t >= 0 && /^[ \t]*$/.test(lines[t]);) t--;
  return lines.length - t <= 2 ? s : lines.slice(0, t + 1).join('\n');
}
function normLabel(s) {
  return s.trim().replace(/\s+/g, ' ').toLowerCase().toUpperCase().toLowerCase();
}
// Find the index of the closing char of a balanced pair; -1 none, -2 open.
function findParen(s, pair) {
  if (s.indexOf(pair[0]) === -1 && s.indexOf(pair[1]) === -1) return -1;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\') i++;
    else if (s[i] === pair[0]) depth++;
    else if (s[i] === pair[1] && (depth--, depth < 0)) return i;
  }
  return depth > 0 ? -2 : -1;
}
// Expand tabs to spaces from a starting column.
function expandTabs(s, col = 0) {
  let t = col, out = '';
  for (const ch of s) {
    if (ch === '\t') { const r = 4 - t % 4; out += ' '.repeat(r); t += r; }
    else { out += ch; t++; }
  }
  return out;
}
// Remove the fence line's indent from fenced code lines.
function fenceDedent(full, code) {
  const m = full.match(/^(\s+)(?:```)/);
  if (m === null) return code;
  const ind = m[1];
  return code.split('\n').map((line) => {
    const sp = line.match(/^\s+/);
    if (sp === null) return line;
    return line.slice(Math.min(sp[0].length, ind.length));
  }).join('\n');
}

// ---------- shared ("other") regexes ----------
const R = {
  codeRemoveIndent: /^(?: {0,3}\t| {1,4})/gm,
  outputLinkReplace: /\\([\[\]])/g,
  indentCodeCompensation: /^(\s+)(?:```)/,
  beginningSpace: /^\s+/,
  endingHash: /#$/,
  startingSpaceChar: /^ /,
  endingSpaceChar: / $/,
  endingSpaceTabChar: /[ \t]$/,
  nonSpaceChar: /[^ ]/,
  newLineCharGlobal: /\n/g,
  tabCharGlobal: /\t/g,
  leadingSpaceTab: /^[ \t]+/,
  multipleSpaceGlobal: /\s+/g,
  blankLine: /^[ \t]*$/,
  doubleBlankLine: /\n[ \t]*\n[ \t]*$/,
  blockquoteStart: /^ {0,3}>/,
  blockquoteSetextReplace: /\n {0,3}((?:=+|-+)[ \t]*)(?=\n|$)/g,
  blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm,
  blockquoteMarkerWhitespace: /^( {0,3}>)([ \t]+)/gm,
  listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g,
  listIsTask: /^\[[ xX]\][ \t]+\S/,
  listReplaceTask: /^\[[ xX]\][ \t]+/,
  listTaskCheckbox: /\[[ xX]\]/,
  anyLine: /\n.*\n/,
  hrefBrackets: /^<(.*)>$/,
  tableDelimiter: /[:|]/,
  tableAlignChars: /^\||\| *$/g,
  tableRowBlankLine: /\n[ \t]*$/,
  tableAlignRight: /^ *-+: *$/,
  tableAlignCenter: /^ *:-+: *$/,
  tableAlignLeft: /^ *:-+ *$/,
  startATag: /^<a /i,
  endATag: /^<\/a>/i,
  startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i,
  endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i,
  startAngleBracket: /^</,
  endAngleBracket: />$/,
  pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/,
  unicodeAlphaNumeric: /[\p{L}\p{N}]/u,
  numericCharacterReference: /&#(?:(\d{1,7})|[Xx]([A-Fa-f0-9]{1,6}));/,
  escapeTest: /[&<>"']/,
  escapeReplace: /[&<>"']/g,
  escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,
  escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,
  caret: /(^|[^\[])\^/g,
  percentDecode: /%25/g,
  findPipe: /\|/g,
  splitPipe: / \|/,
  slashPipe: /\\\|/g,
  carriageReturn: /\r\n|\r/g,
  spaceLine: /^ +$/gm,
  notSpaceStart: /^\S*/,
  endingNewline: /\n$/,
  listItemRegex: (a) => new RegExp(`^( {0,3}${a})((?:[ \t][^\\n]*)?(?:\\n|$))`),
  nextBulletRegex: memo((a) => new RegExp(`^ {0,${a}}(?:[*+-]|\\d{1,9}[.)])((?:[ \t][^\\n]*)?(?:\\n|$))`)),
  hrRegex: memo((a) => new RegExp(`^ {0,${a}}((?:-[ \t]*){3,}|(?:_[ \t]*){3,}|(?:\\*[ \t]*){3,})(?:\\n+|$)`)),
  fencesBeginRegex: memo((a) => new RegExp(`^ {0,${a}}(?:\`\`\`|~~~)`)),
  headingBeginRegex: memo((a) => new RegExp(`^ {0,${a}}#{1,6}(?:\\s|$)`)),
  htmlBeginRegex: memo((a) => new RegExp(`^ {0,${a}}(?:</?(?:${BLOCK_TAGS})(?: +|$|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)`, 'i')),
  blockquoteBeginRegex: memo((a) => new RegExp(`^ {0,${a}}>`)),
};
const BLOCK_TAGS = 'address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul';
const HTML_COMMENT = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;

// ---------- block regexes (GFM set; default options) ----------
const B_NEWLINE = /^(?:[ \t]*(?:\n|$))+/;
const B_CODE = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
const B_FENCES = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}(?:(?=`)\1`*|(?=~)\1~*) *(?=\n|$)|$)/;
const B_HR = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
const B_HEADING = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
const B_BULL = / {0,3}(?:[*+-]|\d{1,9}[.)])/;
const B_PARA_BASE = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table|[ \t]+\n)[^\n]+)*)/;
const B_TEXT = /^[^\n]+/;
const B_LABEL = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\\n]|\n(?![ \t]*\n))+/;
const B_DEF = rx(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/)
  .replace('label', B_LABEL)
  .replace('title', /(?:"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\\n]|\n(?!\n))*'|\((?:\\[\s\S]|[^()\\])*\))/).getRegex();
const B_LIST = rx(/^(bull)([ \t][^\n]*?)?(?:\n|$)/).replace(/bull/g, B_BULL).getRegex();
const B_HTML = rx('^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n*|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>[^\\n]*\\n*|$)|<![A-Z][\\s\\S]*?(?:>[^\\n]*\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>[^\\n]*\\n*|$)|</?(tag)(?:[ \\t]+|\\n|/?>|$)[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)|<(?!(?:script|pre|style|textarea)(?![a-z0-9-]))([a-z][a-z0-9-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$)|</[a-z][a-z0-9-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ \t]*)+\\n|$))', 'i')
  .replace('comment', HTML_COMMENT)
  .replace('tag', BLOCK_TAGS)
  .replace('attribute', / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
const B_TABLE = rx('^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)')
  .replace('hr', B_HR).replace('heading', ' {0,3}#{1,6}(?:\\s|$)').replace('blockquote', ' {0,3}>')
  .replace('code', /(?: {4}| {0,3}\t)[^\n]/).replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)')
  .replace('list', ' {0,3}(?:[*+-]|1[.)])[ \\t]')
  .replace('html', ' {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)').replace('tag', BLOCK_TAGS).getRegex();
// GFM setext-heading regex (built from the shared lheading template).
// Note: fences/blockquote/heading/html/table occur twice (both lookaheads),
// so these replaces must be global, exactly as marked builds them.
const B_LHEADING = rx(/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |fences|blockquote|heading|hr|html|table))+?)\n {0,3}(=+|-+)[ \t]*(?:\n+|$)/)
  .replace(/bull/g, B_BULL).replace(/blockCode/g, /(?: {4}| {0,3}\t)/)
  .replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/)
  .replace(/heading/g, / {0,3}#{1,6}(?:\s|$)/)
  .replace(/hr/g, / {0,3}(?:(?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/)
  .replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
// GFM paragraph regex: stops at hr/heading/blockquote/fences/list/html/table.
const B_PARAGRAPH = rx(B_PARA_BASE)
  .replace('hr', B_HR).replace('heading', ' {0,3}#{1,6}(?:\\s|$)').replace('|lheading', '')
  .replace('table', B_TABLE).replace('blockquote', ' {0,3}>')
  .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)')
  .replace('list', ' {0,3}(?:[*+-]|1[.)])[ \\t]+[^ \\t\\n]')
  .replace('html', ' {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)').replace('tag', BLOCK_TAGS).getRegex();
// Normal (non-GFM) paragraph, used inside blockquotes.
const B_PARAGRAPH_NORMAL = rx(B_PARA_BASE)
  .replace('hr', B_HR).replace('heading', ' {0,3}#{1,6}(?:\\s|$)').replace('|lheading', '').replace('|table', '')
  .replace('blockquote', ' {0,3}>')
  .replace('fences', ' {0,3}(?:`{3,}(?=[^`\\n]*(?:\\n|$))|~~~)[^\\n]*(?:\\n|$)')
  .replace('list', ' {0,3}(?:[*+-]|\\d{1,9}[.)])(?:[ \\t]|\\n|$)')
  .replace('html', ' {0,3}(?:</?(?:tag)(?: +|\\n|/?>)|<(?:(?:script|pre|style|textarea)(?:[\\s>]|$)|!--)|<\\?|<![A-Za-z]|<!\\[CDATA\\[)').replace('tag', BLOCK_TAGS).getRegex();
const B_BLOCKQUOTE = rx(/^( {0,3}> ?(?:(?![ \t]*(?:\n|$))(paragraph)|[^\n]*)(?:\n|$))+/).replace('paragraph', B_PARAGRAPH_NORMAL).getRegex();

// ---------- inline regexes (GFM set; default options) ----------
const I_ESCAPE = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
const I_CODE = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
const I_BR = /^( {2,}|\\)\n(?!\s*$)[ \t]*/;
const PUNCT = /[\p{P}\p{S}]/u;
const PUNCT_SPACE = /[\s\p{P}\p{S}]/u;
const NOT_PUNCT_SPACE = /[^\s\p{P}\p{S}]/u;
const DEL_PUNCT = /(?!~)[\p{P}\p{S}]/u;
const DEL_PUNCT_SPACE = /(?!~)[\s\p{P}\p{S}]/u;
const DEL_NOT_PUNCT_SPACE = /(?:[^\s\p{P}\p{S}]|~)/u;
const I_PUNCTUATION = rx(/^((?![*_])punctSpace)/, 'u').replace(/punctSpace/g, PUNCT_SPACE).getRegex();
const I_OPEN_QUOTE = /[\p{Pi}\p{Ps}"']/u;
const I_ANY_PUNCT = rx(/\\(punct)/, 'gu').replace(/punct/g, PUNCT).getRegex();
const I_ANY_PUNCT_OUTSIDE_CODE = rx(/(`+)(?:[^`]|[^`][\s\S]*?[^`])\1(?!`)|`+|\\(punct)/, 'gu').replace(/punct/g, PUNCT).getRegex();
const I_AUTOLINK = rx(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/)
  .replace('scheme', /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/)
  .replace('email', /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
const I_TAG = rx('^comment|^</[a-zA-Z][a-zA-Z0-9-]*\\s*>|^<[a-zA-Z][a-zA-Z0-9-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>')
  .replace('comment', rx(HTML_COMMENT).replace('(?:-->|$)', '-->').getRegex())
  .replace('attribute', /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
const I_LABEL_BRACKET = /\[(?:\\[\s\S]|[^\[\]\\])*\]/;
const I_LABEL = rx(/(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/).replace('brackets', I_LABEL_BRACKET).getRegex();
const I_LINK = rx(/^!?\[(label)\]\([ \t\n]*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?[ \t\n]*\)/)
  .replace('label', I_LABEL).replace('href', /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]+|(?=\))/)
  .replace('title', /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\((?:\\[\s\S]|[^)\\])*\)/).getRegex();
const I_REFLINK = rx(/^!?\[(label)\]\[(ref)\]/).replace('label', I_LABEL).replace('ref', B_LABEL).getRegex();
const I_NOLINK = rx(/^!?\[(ref)\](?:\[\])?/).replace('ref', B_LABEL).getRegex();
const I_REFLINK_SEARCH = rx('reflink|nolink(?!\\()', 'g')
  .replace('reflink', rx(/^!?\[(label)\]\[(ref)\]/).replace('label', rx(/(?:[^\[\]\\`]*(?:\[(?:brackets|\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\]))){0,999}?[^\[\]\\`]*?/).replace('brackets', I_LABEL_BRACKET).getRegex()).replace('ref', /(?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999}/).getRegex())
  .replace('nolink', rx(/^!?\[(ref)\](?:\[\])?/).replace('ref', /(?!\s*\])(?:\\[\s\S]|[^\[\]\\]){1,999}/).getRegex()).getRegex();
const I_URL = (() => {
  const email = /[A-Za-z0-9._+-]+@[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/;
  const proto = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
  const at = rx(/(?:mailto:email|xmpp:email(?:\/[A-Za-z0-9@.]+)?)/).replace(/email/g, email).getRegex();
  return rx(/^emailProtocol|^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/)
    .replace('emailProtocol', at).replace('protocol', proto)
    .replace('email', /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![\w-])/).getRegex();
})();
const I_BACKPEDAL = /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/;
const I_DEL = /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/;
// Emphasis/delimiter regexes. The replace order matters (notPunctSpace
// before punctSpace before punct) because each is a substring of the next.
const EM_L_TEMPLATE = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/;
const I_EM_L_DELIM = rx(EM_L_TEMPLATE, 'u').replace(/punct/g, DEL_PUNCT).getRegex();
const EM_R_AST = '^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)';
const I_EM_R_DELIM_AST = rx(EM_R_AST, 'gu').replace(/notPunctSpace/g, DEL_NOT_PUNCT_SPACE).replace(/punctSpace/g, DEL_PUNCT_SPACE).replace(/punct/g, DEL_PUNCT).getRegex();
const EM_R_UND = '^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)';
const I_EM_R_DELIM_UND = rx(EM_R_UND, 'gu').replace(/notPunctSpace/g, NOT_PUNCT_SPACE).replace(/punctSpace/g, PUNCT_SPACE).replace(/punct/g, PUNCT).getRegex();
const I_DEL_L_DELIM = rx(/^~~?(?:((?!~)punct)|[^\s~])/, 'u').replace(/punct/g, PUNCT).getRegex();
const DEL_R = '^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)';
const I_DEL_R_DELIM = rx(DEL_R, 'gu').replace(/notPunctSpace/g, NOT_PUNCT_SPACE).replace(/punctSpace/g, PUNCT_SPACE).replace(/punct/g, PUNCT).getRegex();
// The GFM inline text regex (built exactly as marked builds it, including
// the replace order: "protocol" first, then /emailProtocol/g).
const I_TEXT = rx(/^(?:[^a-zA-Z0-9](?=emailProtocol)|(`+|~+|[^`~])(?:(?=[`~])|(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|wwwStart|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9](?=emailProtocol)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@))))/)
  .replace('protocol', /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/)
  .replace(/emailProtocol/g, /(?:mailto|xmpp):/)
  .replace('wwwStart', '(?<![^\\s*_~(])www\\.').getRegex();
// Link/image/code/tag mask: hides * _ ~ inside those spans (length kept).
const I_BLOCK_SKIP = rx(/link|precode-code|html/, 'g')
  .replace('link', /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/)
  .replace('precode-', '(?<!`)()').replace('code', /(?<b>`+)[^`]+\k<b>(?!`)/)
  .replace('html', /<(?! )[^<>]*?>/).getRegex();

// ---------- per-parse state (reset by parse()) ----------
let links; // Object.create(null): normalized label -> {href, title}
let inLink, inRawBlock, linkEmitted, linkParenPossible, top;

// Does this text contain a link that would render (used by the mask)?
function linkInText(s) {
  if (!s.includes('[')) return false;
  for (const m of s.matchAll(I_BLOCK_SKIP)) {
    if (I_LINK.test(m[0]) && s.charAt(m.index - 1) !== '!') return true;
  }
  for (const m of s.matchAll(I_REFLINK_SEARCH)) {
    const t = m[0], r = t.lastIndexOf('[');
    if (!(t.charAt(0) === '!' || !Object.hasOwn(links, normLabel(t.slice(r + 1, -1)))) && !(r > 1 && linkInText(t.slice(1, r - 1)))) return true;
  }
  return false;
}
// Length-preserving mask: hides * _ ~ inside reference links, code spans,
// inline links and tags, so emphasis scanning sees the same closers marked
// sees. Escaped punctuation is hidden too.
function maskSrc(s) {
  let t = s;
  if (links && s.includes('[')) {
    const re = I_REFLINK_SEARCH;
    const sub = (r) => {
      const o = r.lastIndexOf('[');
      if (!Object.hasOwn(links, normLabel(r.slice(o + 1, -1)))) return r;
      if (o > 1 && r.charAt(0) !== '!') {
        const inner = r.slice(1, o - 1);
        if (linkInText(inner)) return '[' + inner.replace(re, sub) + '][' + 'a'.repeat(r.length - o - 2) + ']';
      }
      return '[' + 'a'.repeat(r.length - 2) + ']';
    };
    t = t.replace(re, sub);
  }
  t = t.replace(I_ANY_PUNCT_OUTSIDE_CODE, (n, g1, g2) => g2 ? '+'.repeat(n.length) : g1 ? g1 + n.slice(g1.length, -g1.length).replace(/`/g, '+') + g1 : n);
  t = t.replace(I_BLOCK_SKIP, (n, g1, g2) => {
    const o = g2 ? g2.length : 0;
    return n.slice(0, o) + '[' + 'a'.repeat(n.length - o - 2) + ']';
  });
  return t;
}
// Scan a masked source for the last possible closer of each delimiter run:
// a run counts when the character before it is not whitespace.
function scanMask(s) {
  const em = { '*': -1, '_': -1 };
  let del = -1;
  const n = s.length;
  for (let i = 0; i < n; i++) {
    const ch = s[i];
    if (ch !== '*' && ch !== '_' && ch !== '~') continue;
    const prev = i === 0 ? '\n' : s[i - 1];
    let j = i + 1;
    for (; j < n && s[j] === ch;) j++;
    if (prev !== ' ' && prev !== '\t' && prev !== '\n' && prev !== '\r' && prev !== '\f') {
      if (ch === '~') del = i; else em[ch] = i;
    }
    i = j - 1;
  }
  return { em, del };
}

// ---------- inline helpers ----------
// Reject a link whose text contains a tag that runs past the link text.
function hasNestedLink(fullSrc, linkText, offset) {
  if (!linkText.includes('<')) return false;
  for (let i = 0; i < linkText.length; i++) {
    if (linkText[i] === '\\') { i++; continue; }
    if (linkText[i] === '`') {
      const m = I_CODE.exec(linkText.slice(i));
      if (m) { i += m[0].length - 1; continue; }
    }
    if (linkText[i] !== '<') continue;
    const r = fullSrc.slice(offset + i);
    const o = I_TAG.exec(r) || I_AUTOLINK.exec(r);
    if (o) {
      if (o[0].length > linkText.length - i) return true;
      i += o[0].length - 1;
    }
  }
  return false;
}
// Build a link/image's HTML from its match, reference and raw text.
// Renders the link text (plain mode for images, current mode for links),
// enforces the no-nested-link rule, and maintains inLink/linkEmitted.
function doLink(m, ref, raw, plain) {
  const text = m[1].replace(R.outputLinkReplace, '$1');
  const isImage = m[0].charAt(0) === '!';
  const prevInLink = inLink, prevEmitted = linkEmitted, prevRawBlock = inRawBlock;
  inLink = true; linkEmitted = false;
  const inner = inlineRender(text, isImage ? true : plain);
  const nested = linkEmitted;
  linkEmitted = prevEmitted; inLink = prevInLink;
  if (!isImage) {
    if (nested) { inRawBlock = prevRawBlock; return null; }
    linkEmitted = true;
    // Plain mode (image alt text): a link renders as its text, no <a> tag.
    if (plain) return { html: inner, len: raw.length };
    const href = encURI(ref.href);
    if (href === null) return { html: inner, len: raw.length };
    let out = '<a href="' + esc(href) + '"';
    if (ref.title) out += ' title="' + esc(ref.title) + '"';
    return { html: out + '>' + inner + '</a>', len: raw.length };
  }
  // Plain mode: an image renders as its alt text, no <img> tag.
  if (plain) return { html: inner, len: raw.length };
  const href = encURI(ref.href);
  if (href === null) return { html: esc(inner), len: raw.length };
  let out = `<img src="${esc(href)}" alt="${esc(inner)}"`;
  if (ref.title) out += ` title="${esc(ref.title)}"`;
  return { html: out + '>', len: raw.length };
}
function linkTok(src, plain) {
  if (linkParenPossible === false) return null;
  const m = I_LINK.exec(src);
  if (!m) return null;
  const off = m[0].charAt(0) === '!' ? 2 : 1;
  if (hasNestedLink(src, m[1], off)) return null;
  const hrefTrim = m[2].trim();
  if (R.startAngleBracket.test(hrefTrim)) {
    if (!R.endAngleBracket.test(hrefTrim)) return null;
    const stripped = rtrim(hrefTrim.slice(0, -1), '\\');
    if ((hrefTrim.length - stripped.length) % 2 === 0) return null;
  } else {
    const closeIdx = findParen(m[2], '()');
    if (closeIdx === -2) return null;
    if (closeIdx > -1) {
      const h = (m[0].indexOf('!') === 0 ? 5 : 4) + m[1].length + closeIdx;
      m[2] = m[2].substring(0, closeIdx);
      m[0] = m[0].substring(0, h).trim();
      m[3] = '';
    }
  }
  const backTrim = rtrim(m[0].slice(0, -1), '\\');
  if ((m[0].length - backTrim.length) % 2 === 0) return null;
  let url = m[2];
  const title = m[3] ? m[3].slice(1, -1) : '';
  url = url.trim();
  if (R.startAngleBracket.test(url)) url = url.slice(1, -1);
  return doLink(m, {
    href: url && url.replace(I_ANY_PUNCT, '$1'),
    title: title && title.replace(I_ANY_PUNCT, '$1'),
  }, m[0], plain);
}
function reflinkTok(src, plain) {
  const m = I_REFLINK.exec(src) || I_NOLINK.exec(src);
  if (!m) return null;
  const off = m[0].charAt(0) === '!' ? 2 : 1;
  if (hasNestedLink(src, m[1], off)) return null;
  const ref = links[normLabel(m[2] || m[1])];
  if (!ref) {
    const ch = m[0].charAt(0);
    return { html: ch, len: 1 };
  }
  return doLink(m, ref, m[0], plain);
}
function autolinkTok(src, plain) {
  const m = I_AUTOLINK.exec(src);
  if (!m) return null;
  let text, href;
  if (m[2] === '@') { text = m[1]; href = 'mailto:' + text; }
  else { text = m[1]; href = text; }
  if (plain) return { html: text, len: m[0].length };
  const enc = encURI(href);
  if (enc === null) return { html: esc(text, true), len: m[0].length };
  return { html: `<a href="${esc(enc, true)}">${esc(text, true)}</a>`, len: m[0].length };
}

// Cheap pre-check so the URL regex only runs where it could match.
// No false negatives: every string the URL regex matches passes this.
function mayBeUrl(s) {
  const c = s.charCodeAt(0);
  if (c === 119 && s.startsWith('www.')) return true; // w
  if ((c === 104 || c === 72) && /^[hH][tT][tT][pP][sS]?:\/\//.test(s)) return true; // h/H
  if ((c === 102 || c === 70) && /^[fF][tT][pP]:\/\//.test(s)) return true; // f/F
  if (c === 109 && s.startsWith('mailto:')) return true; // m
  if (c === 120 && s.startsWith('xmpp:')) return true; // x
  if ((c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 46 || c === 95 || c === 43 || c === 45) {
    let i = 0;
    while (i < s.length) {
      const d = s.charCodeAt(i);
      if ((d >= 48 && d <= 57) || (d >= 65 && d <= 90) || (d >= 97 && d <= 122) || d === 46 || d === 95 || d === 43 || d === 45) i++;
      else break;
    }
    return s.charCodeAt(i) === 64; // @
  }
  return false;
}
function urlTok(src, plain) {
  const m = I_URL.exec(src);
  if (!m) return null;
  let text, href;
  if (m[2] === '@') { text = m[0]; href = 'mailto:' + text; }
  else {
    let cur = m[0];
    for (;;) {
      const next = I_BACKPEDAL.exec(cur)?.[0] ?? '';
      if (next === cur) break;
      cur = next;
    }
    text = cur;
    href = m[1] === 'www.' ? 'http://' + cur : cur;
  }
  const enc = encURI(href);
  if (enc === null) return { html: esc(text, true), len: text.length };
  return { html: `<a href="${esc(enc, true)}">${esc(text, true)}</a>`, len: text.length };
}
function escapeTok(src, plain) {
  const m = I_ESCAPE.exec(src);
  if (!m) return null;
  return { html: plain ? m[1] : esc(m[1]), len: m[0].length };
}
function tagTok(src) {
  const m = I_TAG.exec(src);
  if (!m) return null;
  if (!inLink && R.startATag.test(m[0])) inLink = true;
  else if (inLink && R.endATag.test(m[0])) inLink = false;
  if (!inRawBlock && R.startPreScriptTag.test(m[0])) inRawBlock = true;
  else if (inRawBlock && R.endPreScriptTag.test(m[0])) inRawBlock = false;
  return { html: m[0], len: m[0].length };
}
function codespanTok(src, plain) {
  const m = I_CODE.exec(src);
  if (!m) return null;
  let text = m[2].replace(R.newLineCharGlobal, ' ');
  if (R.nonSpaceChar.test(text) && R.startingSpaceChar.test(text) && R.endingSpaceChar.test(text)) {
    text = text.substring(1, text.length - 1);
  }
  return { html: plain ? text : `<code>${esc(text, true)}</code>`, len: m[0].length };
}
function brTok(src, plain) {
  const m = I_BR.exec(src);
  if (!m) return null;
  return { html: plain ? '' : '<br>', len: m[0].length };
}
function inlineTextTok(src, plain) {
  const m = I_TEXT.exec(src);
  if (!m) return null;
  const raw = m[0];
  const text = inRawBlock ? raw : unesc(raw);
  // marked: text token has escaped=inRawBlock; the renderer returns text
  // as-is when escaped (or in the plain text renderer), else escapes it.
  return { html: (plain || inRawBlock) ? text : esc(text), len: raw.length, raw, isText: true };
}

// Emphasis / strong: port of marked's emStrong, emitting HTML directly.
// src = remaining text, full = the whole inline source, mask = closer
// indices for full, prevCh = char before this position, plain = text mode.
function emStrongTok(src, full, masked, mask, prevCh, plain) {
  const m = I_EM_L_DELIM.exec(src);
  if (!m || (!m[1] && !m[2] && !m[3] && !m[4])) return null;
  const r = m[0][0];
  const prevIsDelim = prevCh === r;
  const i = full.length - src.length;
  let l = i;
  for (; l > 0 && masked[l - 1] === r;) l--;
  const p = [...masked.slice(Math.max(0, l - 2), l)].at(-1) ?? '';
  const h = p === '*' || p === '_' || !!I_PUNCTUATION.exec(p);
  let n = prevCh;
  if (l < i) n = p;
  const u = l < i ? h : !!I_PUNCTUATION.exec(n);
  if (m[4] && n.match(R.unicodeAlphaNumeric)) return null;
  const d = m[1] || m[3] || '';
  if (!d || !n || u) {
    const k = [...m[0]].length - 1;
    let g, b, mm = k, f = 0;
    const y = i - l + k;
    const canSingle = !!p.trim() && (!!d || (r === '*' && !h));
    if (r !== '*' && r !== '_') return null;
    const A = r === '*' ? I_EM_R_DELIM_AST : I_EM_R_DELIM_UND;
    const v = mask.em[r];
    const Q = full.length - src.length + k;
    if (v < Q) return null;
    // The closer search runs on the MASKED src (escapes and code spans
    // hidden), while M is sliced from the original src (length-preserving).
    const rest = masked.slice(i + k);
    const ee = v - Q;
    for (A.lastIndex = 0; ;) {
      const s = A.exec(rest);
      if (s === null || s.index > ee) break;
      g = s[1] || s[2] || s[3] || s[4] || s[5] || s[6];
      if (!g) continue;
      b = [...g].length;
      if (s[3] || s[4]) { mm += b; continue; }
      else if (s[5] || s[6] || canSingle) {
        if (prevIsDelim && (s[5] || s[6])) break;
        if (y % 3 && !((y + b) % 3)) { f += b; continue; }
      }
      if (mm -= b, mm > 0) continue;
      b = Math.min(b, b + mm + f);
      const te = [...s[0]][0].length;
      const M = src.slice(0, k + s.index + te + b);
      if (Math.min(k, b) % 2) {
        const U = M.slice(1, -1);
        return { html: plain ? inlineRender(U, plain) : `<em>${inlineRender(U, plain)}</em>`, len: M.length };
      }
      const ne = M.slice(2, -2);
      return { html: plain ? inlineRender(ne, plain) : `<strong>${inlineRender(ne, plain)}</strong>`, len: M.length };
    }
  }
  return null;
}
// Strikethrough: port of marked's del.
function delTok(src, full, masked, mask, prevCh, plain) {
  const m = I_DEL_L_DELIM.exec(src);
  if (!m) return null;
  if (!(m[1] || '') || !prevCh || I_PUNCTUATION.exec(prevCh)) {
    const o = [...m[0]].length - 1;
    let i, l, p = o;
    const h = I_DEL_R_DELIM;
    const u = mask.del;
    const d = full.length - src.length + o;
    if (u < d) return null;
    // Closer search on the masked src; b is sliced from the original src.
    const rest = masked.slice(full.length - src.length + o);
    const k = u - d;
    for (h.lastIndex = 0; ;) {
      const s = h.exec(rest);
      if (s === null || s.index > k) break;
      i = s[1] || s[2] || s[3] || s[4] || s[5] || s[6];
      if (!i || (l = [...i].length, l !== o)) continue;
      if (s[3] || s[4]) { p += l; continue; }
      if (p -= l, p > 0) continue;
      l = Math.min(l, l + p);
      const g = [...s[0]][0].length;
      const b = src.slice(0, o + s.index + g + l);
      const inner = b.slice(o, -o);
      return { html: plain ? inlineRender(inner, plain) : `<del>${inlineRender(inner, plain)}</del>`, len: b.length };
    }
  }
  return null;
}

// Inline rendering: emits HTML directly while scanning (no token objects).
// plain=true renders the text form (used for image alt text).
function inlineRender(src, plain) {
  const savedParen = linkParenPossible;
  linkParenPossible = savedParen && src.includes(')');
  let mask = null, masked = null;
  const ensureMask = () => {
    if (!mask) { masked = maskSrc(src); mask = scanMask(masked); }
  };
  const getMask = () => { ensureMask(); return mask; };
  const getMasked = () => { ensureMask(); return masked; };
  try {
    let out = '';
    let s = src;
    let prevCh = '', lastWasText = false;
    while (s) {
      if (!lastWasText) prevCh = '';
      lastWasText = false;
      let r = null;
      const c = s[0];
      if (c === '\\') r = escapeTok(s, plain) || brTok(s, plain);
      else if (c === '<') r = tagTok(s) || autolinkTok(s, plain);
      else if (c === '[' || c === '!') r = linkTok(s, plain) || reflinkTok(s, plain);
      else if (c === '*' || c === '_') r = emStrongTok(s, src, getMasked(), getMask(), prevCh, plain);
      else if (c === '`') r = codespanTok(s, plain);
      else if (c === '~') r = delTok(s, src, getMasked(), getMask(), prevCh, plain);
      else if (c === ' ' || c === '\n') r = brTok(s, plain);
      if (!r && !inLink && mayBeUrl(s)) r = urlTok(s, plain);
      if (!r) {
        const t = inlineTextTok(s, plain);
        if (t) {
          r = t;
          if (t.raw.slice(-1) !== '_') prevCh = t.raw.slice(-1);
          lastWasText = true;
        }
      }
      if (!r) throw new Error('Infinite loop on byte: ' + s.charCodeAt(0));
      out += r.html;
      s = s.slice(r.len);
    }
    return out;
  } finally {
    linkParenPossible = savedParen;
  }
}

// ---------- block tokenizers (fused: blocks carry inline srcs) ----------
// Block shapes: {t, raw, ...}. Inline content is kept as `text` and
// rendered after all block lexing, so link definitions are always known.
function tokSpace(src) {
  const m = B_NEWLINE.exec(src);
  if (m && m[0].length > 0) return { t: 'space', raw: m[0] };
  return null;
}
function tokCode(src) {
  const m = B_CODE.exec(src);
  if (!m) return null;
  const n = trimBlanks(m[0]);
  return { t: 'code', raw: n, text: n.replace(R.codeRemoveIndent, ''), lang: '' };
}
function tokFences(src) {
  const m = B_FENCES.exec(src);
  if (!m) return null;
  return {
    t: 'code', raw: m[0],
    lang: m[2] ? m[2].trim().replace(I_ANY_PUNCT, '$1') : m[2],
    text: fenceDedent(m[0], m[3] || ''),
  };
}
function tokHeading(src) {
  const m = B_HEADING.exec(src);
  if (!m) return null;
  let n = m[2].trim();
  if (R.endingHash.test(n)) {
    const s = rtrim(n, '#');
    if (!s || R.endingSpaceTabChar.test(s)) n = s.trim();
  }
  return { t: 'heading', raw: rtrim(m[0], '\n'), depth: m[1].length, text: n };
}
function tokHr(src) {
  const m = B_HR.exec(src);
  if (!m) return null;
  return { t: 'hr', raw: rtrim(m[0], '\n') };
}
function tokHtml(src) {
  const m = B_HTML.exec(src);
  if (!m) return null;
  const n = trimBlanks(m[0]);
  return { t: 'html', raw: n, pre: m[1] === 'pre' || m[1] === 'script' || m[1] === 'style', text: n };
}
function tokDef(src) {
  const m = B_DEF.exec(src);
  if (!m) return null;
  if (!R.startAngleBracket.test(m[2]) && findParen(m[2], '()') !== -1) return null;
  return {
    t: 'def', raw: rtrim(m[0], '\n'), tag: normLabel(m[1]),
    href: m[2] ? m[2].replace(R.hrefBrackets, '$1').replace(I_ANY_PUNCT, '$1') : '',
    title: m[3] ? m[3].substring(1, m[3].length - 1).replace(I_ANY_PUNCT, '$1') : m[3],
  };
}
function tokTable(src) {
  const m = B_TABLE.exec(src);
  if (!m || !R.tableDelimiter.test(m[2])) return null;
  const headerCells = splitCells(m[1]);
  const aligns = m[2].replace(R.tableAlignChars, '').split('|');
  const rows = m[3] && m[3].trim() ? m[3].replace(R.tableRowBlankLine, '').split('\n') : [];
  const table = { t: 'table', raw: rtrim(m[0], '\n'), header: [], align: [], rows: [] };
  if (headerCells.length !== aligns.length) return null;
  for (const a of aligns) {
    if (R.tableAlignRight.test(a)) table.align.push('right');
    else if (R.tableAlignCenter.test(a)) table.align.push('center');
    else if (R.tableAlignLeft.test(a)) table.align.push('left');
    else table.align.push(null);
  }
  for (let i = 0; i < headerCells.length; i++) {
    table.header.push({ text: headerCells[i], align: table.align[i] });
  }
  for (const row of rows) {
    table.rows.push(splitCells(row, table.header.length).map((cell, j) => ({ text: cell, align: table.align[j] })));
  }
  return table;
}
// Setext heading, with a bounded gate: the expensive lazy regex only runs
// when a =+ / -+ underline exists before the next blank line.
function tokLheading(src) {
  const blankAt = src.search(/\n[ \t]*\n/);
  const region = blankAt === -1 ? src : src.slice(0, blankAt + 1);
  if (!/(?:^|\n) {0,3}(?:=+|-+)[ \t]*(?:\n|$)/.test(region)) return null;
  const m = B_LHEADING.exec(src);
  if (!m) return null;
  return { t: 'heading', raw: rtrim(m[0], '\n'), depth: m[2].charAt(0) === '=' ? 1 : 2, text: m[1].trim() };
}
function tokParagraph(src) {
  const m = B_PARAGRAPH.exec(src);
  if (!m) return null;
  const n = m[1].charAt(m[1].length - 1) === '\n' ? m[1].slice(0, -1) : m[1];
  return { t: 'paragraph', raw: m[0], text: n };
}
function tokText(src) {
  const m = B_TEXT.exec(src);
  if (!m) return null;
  return { t: 'text', raw: m[0], text: m[0] };
}

// ---------- blockquote ----------
function tokBlockquote(src) {
  const m = B_BLOCKQUOTE.exec(src);
  if (!m) return null;
  let lines = rtrim(m[0], '\n').split('\n');
  let raw = '', text = '';
  const tokens = [];
  while (lines.length > 0) {
    let inQuote = false, chunkLines = [], p;
    for (p = 0; p < lines.length; p++) {
      if (R.blockquoteStart.test(lines[p])) { chunkLines.push(lines[p]); inQuote = true; }
      else if (!inQuote) chunkLines.push(lines[p]);
      else break;
    }
    lines = lines.slice(p);
    const h = chunkLines.join('\n');
    const u = h
      .replace(R.blockquoteMarkerWhitespace, (g, b, m2) => b + expandTabs(m2, b.length))
      .replace(R.blockquoteSetextReplace, '\n    $1')
      .replace(R.blockquoteSetextReplace2, '');
    raw = raw ? raw + '\n' + h : h;
    text = text ? text + '\n' + u : u;
    const savedTop = top;
    top = true;
    blockTokens(u, tokens, true);
    top = savedTop;
    if (lines.length === 0) break;
    const k = tokens[tokens.length - 1];
    if (k && (k.t === 'code' || k.t === 'heading' || k.t === 'hr' || k.t === 'html' || k.t === 'table')) break;
    if (k && k.t === 'blockquote') {
      const g = k, b = lines.join('\n');
      const mm = g.raw + '\n' + b.replace(R.blockquoteSetextReplace2, '');
      const f = tokBlockquote(mm);
      tokens[tokens.length - 1] = f;
      const y = mm.substring(f.raw.length).replace(/^\n/, '');
      const nLeft = y ? y.split('\n').length : 0;
      const consumed = nLeft ? lines.slice(0, -nLeft) : lines;
      if (consumed.length > 0) raw = raw + '\n' + consumed.join('\n');
      text = text.substring(0, text.length - g.text.length) + f.text;
      lines = lines.slice(consumed.length);
      if (lines.length > 0 && R.blockquoteStart.test(lines[0])) continue;
      break;
    } else if (k && k.t === 'list') {
      const g = k, b = g.raw + '\n' + lines.join('\n');
      const mm = tokList(b);
      tokens[tokens.length - 1] = mm;
      const f = mm.raw.length > g.raw.length ? b.slice(g.raw.length + 1, mm.raw.length).split('\n').length : 0;
      if (f > 0) {
        const y = lines.slice(0, f).join('\n');
        raw = raw + '\n' + y;
        text = text + '\n' + y;
      }
      lines = lines.slice(f);
      continue;
    }
  }
  return { t: 'blockquote', raw, text, blocks: tokens };
}

// ---------- list ----------
function tokList(src) {
  let e = src;
  const t = B_LIST.exec(e);
  if (!t) return null;
  const n = e;
  const consumed = () => n.length - e.length;
  let r = t[1].trim();
  const ordered = r.length > 1;
  const list = { t: 'list', raw: '', ordered, start: ordered ? +r.slice(0, -1) : '', loose: false, items: [] };
  r = ordered ? `\\d{1,9}\\${r.slice(-1)}` : `\\${r}`;
  const itemRe = R.listItemRegex(r);
  let p = false;
  for (; e;) {
    let ended = false, body = '';
    const m2 = itemRe.exec(e);
    if (!m2 || B_HR.test(e)) break;
    const k = consumed();
    e = e.substring(m2[0].length);
    const g = m2[2].split('\n', 1)[0];
    const b = m2[1].length;
    let mLine = g.replace(R.leadingSpaceTab, v => expandTabs(v, b));
    let f = e.split('\n', 1)[0];
    let y = !mLine.trim();
    let Rr = 0;
    if (y) Rr = b + 1;
    else {
      Rr = mLine.search(R.nonSpaceChar);
      Rr = Rr > 4 ? 1 : Rr;
      body = mLine.slice(Rr);
      Rr += b;
    }
    if (y && R.blankLine.test(f)) { e = e.substring(f.length + 1); ended = true; }
    if (!ended) {
      const v = R.nextBulletRegex(Rr), Q = R.hrRegex(Rr), ee = R.fencesBeginRegex(Rr),
        te = R.headingBeginRegex(Rr), M = R.htmlBeginRegex(Rr), ne = R.blockquoteBeginRegex(Rr);
      for (; e;) {
        const U = e.split('\n', 1)[0];
        f = U;
        const Z = f.replace(R.leadingSpaceTab, me => expandTabs(me));
        if (ee.test(f) || te.test(f) || M.test(f) || ne.test(f) || v.test(f) || Q.test(f)) break;
        if (Z.search(R.nonSpaceChar) >= Rr || !f.trim()) body += '\n' + Z.slice(Rr);
        else {
          if (y || mLine.replace(R.tabCharGlobal, '    ').search(R.nonSpaceChar) >= 4 || ee.test(mLine) || te.test(mLine) || M.test(mLine) || Q.test(mLine)) break;
          const qe = /^ {0,3}(?:=+|-+) *$/.test(f) && B_LHEADING.test(`${mLine}\n${f}`) ? `    ${Z.replace(/^ {0,3}/, '')}` : f;
          body += '\n' + qe;
        }
        y = !f.trim();
        e = e.substring(U.length + 1);
        mLine = Z.slice(Rr);
      }
    }
    const A = n.slice(k, consumed());
    if (!list.loose) {
      if (p) list.loose = true;
      else if (R.doubleBlankLine.test(A)) p = true;
    }
    list.items.push({ t: 'list_item', raw: A, task: R.listIsTask.test(body), loose: false, text: body, blocks: [] });
  }
  const last = list.items[list.items.length - 1];
  if (!last) return null;
  last.raw = last.raw.trimEnd();
  last.text = last.text.trimEnd();
  list.raw = n.slice(0, consumed()).trimEnd();
  for (const item of list.items) {
    // marked sets top=false here and does NOT restore it: blockTokens
    // leaves top=true, and a nested list/block inside the item can flip
    // it back to true mid-item, so later content lexes as paragraphs.
    top = false;
    item.blocks = blockTokens(item.text, []);
    if (!list.loose) {
      const spaces = item.blocks.filter(x => x.t === 'space');
      if (spaces.length > 0 && spaces.some(x => R.anyLine.test(x.raw))) list.loose = true;
    }
  }
  for (const item of list.items) {
    const d = item.blocks[0];
    if (item.task && (d?.t === 'text' || d?.t === 'paragraph')) {
      item.text = item.text.replace(R.listReplaceTask, '');
      d.raw = d.raw.replace(R.listReplaceTask, '');
      d.text = d.text.replace(R.listReplaceTask, '');
      const kk = R.listTaskCheckbox.exec(item.raw);
      if (kk) {
        const g = { t: 'checkbox', raw: kk[0] + ' ', checked: kk[0] !== '[ ]' };
        item.checked = g.checked;
        if (list.loose) {
          if (d.t === 'paragraph' || d.t === 'text') {
            d.raw = g.raw + d.raw;
            d.checkbox = g;
          } else {
            item.blocks.unshift({ t: 'paragraph', raw: g.raw, text: '', checkbox: g });
          }
        } else {
          item.checkbox = g;
        }
      }
    } else if (item.task) item.task = false;
  }
  if (list.loose) {
    for (const item of list.items) {
      item.loose = true;
      for (const d of item.blocks) if (d.t === 'text') d.t = 'paragraph';
    }
  }
  return list;
}

// ---------- block lexing loop ----------
function blockTokens(src, tokens, inBlockquote) {
  let s = 1 / 0;
  let mergePara = inBlockquote;
  while (src) {
    if (src.length < s) s = src.length;
    else throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
    let r;
    if ((r = tokSpace(src))) {
      src = src.substring(r.raw.length);
      const prev = tokens[tokens.length - 1];
      if (r.raw.length === 1 && prev !== undefined) prev.raw += '\n';
      else tokens.push(r);
      continue;
    }
    if ((r = tokCode(src))) {
      src = src.substring(r.raw.length);
      const prev = tokens[tokens.length - 1];
      if (prev && (prev.t === 'paragraph' || prev.t === 'text')) {
        prev.raw += (prev.raw.endsWith('\n') ? '' : '\n') + r.raw;
        prev.text += '\n' + r.text;
      } else tokens.push(r);
      continue;
    }
    if ((r = tokFences(src))) { src = src.substring(r.raw.length); tokens.push(r); continue; }
    if ((r = tokHeading(src))) { src = src.substring(r.raw.length); tokens.push(r); continue; }
    if ((r = tokHr(src))) { src = src.substring(r.raw.length); tokens.push(r); continue; }
    if ((r = tokBlockquote(src))) { src = src.substring(r.raw.length); tokens.push(r); continue; }
    if ((r = tokList(src))) { src = src.substring(r.raw.length); tokens.push(r); continue; }
    if ((r = tokHtml(src))) { src = src.substring(r.raw.length); tokens.push(r); continue; }
    if ((r = tokDef(src))) {
      src = src.substring(r.raw.length);
      const prev = tokens[tokens.length - 1];
      if (prev && (prev.t === 'paragraph' || prev.t === 'text')) {
        prev.raw += (prev.raw.endsWith('\n') ? '' : '\n') + r.raw;
        prev.text += '\n' + r.raw;
      } else {
        if (!links[r.tag]) links[r.tag] = { href: r.href, title: r.title };
        tokens.push(r);
      }
      continue;
    }
    if ((r = tokTable(src))) { src = src.substring(r.raw.length); tokens.push(r); continue; }
    if ((r = tokLheading(src))) { src = src.substring(r.raw.length); tokens.push(r); continue; }
    if (top && (r = tokParagraph(src))) {
      src = src.substring(r.raw.length);
      const prev = tokens[tokens.length - 1];
      if (mergePara && prev && prev.t === 'paragraph') {
        prev.raw += (prev.raw.endsWith('\n') ? '' : '\n') + r.raw;
        prev.text += '\n' + r.text;
      } else tokens.push(r);
      mergePara = false;
      continue;
    }
    if ((r = tokText(src))) {
      src = src.substring(r.raw.length);
      const prev = tokens[tokens.length - 1];
      if (prev && prev.t === 'text') {
        prev.raw += (prev.raw.endsWith('\n') ? '' : '\n') + r.raw;
        prev.text += '\n' + r.text;
      } else tokens.push(r);
      continue;
    }
    if (src) throw new Error('Infinite loop on byte: ' + src.charCodeAt(0));
  }
  top = true;
  return tokens;
}

// ---------- renderer ----------
// Top-level inline render for one block's (or table cell's) content.
// marked resets inRawBlock to false before tokenizing each block's inline
// source (a <code> tag in one block must not leak into the next); nested
// renders (link text, emphasis) inherit it instead, so they call
// inlineRender directly.
function inlineBlock(src) {
  inRawBlock = false;
  return inlineRender(src, false);
}
function checkboxHTML(checked) {
  return '<input ' + (checked ? 'checked="" ' : '') + 'disabled="" type="checkbox"> ';
}
function tableCell(cell, isHeader) {
  const tag = isHeader ? 'th' : 'td';
  return (cell.align ? `<${tag} align="${cell.align}">` : `<${tag}>`) + inlineBlock(cell.text) + `</${tag}>\n`;
}
function renderBlocks(blocks) {
  let out = '';
  for (const b of blocks) {
    switch (b.t) {
      case 'space': break;
      case 'code': {
        const langWord = (b.lang || '').match(R.notSpaceStart)?.[0];
        const text = b.text ? b.text.replace(R.endingNewline, '') + '\n' : '';
        out += langWord
          ? `<pre><code class="language-${esc(langWord)}">${esc(text, true)}</code></pre>\n`
          : `<pre><code>${esc(text, true)}</code></pre>\n`;
        break;
      }
      case 'heading':
        out += `<h${b.depth}>${inlineBlock(b.text)}</h${b.depth}>\n`;
        break;
      case 'hr': out += '<hr>\n'; break;
      case 'blockquote':
        out += `<blockquote>\n${renderBlocks(b.blocks)}</blockquote>\n`;
        break;
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul';
        const startAttr = b.ordered && b.start !== 1 ? ` start="${b.start}"` : '';
        let items = '';
        for (const item of b.items) {
          items += '<li>';
          if (item.checkbox) items += checkboxHTML(item.checked);
          items += renderBlocks(item.blocks);
          items += '</li>\n';
        }
        out += `<${tag}${startAttr}>\n${items}</${tag}>\n`;
        break;
      }
      case 'html': out += b.text; break;
      case 'def': break;
      case 'table': {
        let head = '';
        for (const cell of b.header) head += tableCell(cell, true);
        let tbody = '';
        for (const row of b.rows) {
          let cells = '';
          for (const cell of row) cells += tableCell(cell, false);
          tbody += `<tr>\n${cells}</tr>\n`;
        }
        out += `<table>\n<thead>\n<tr>\n${head}</tr>\n</thead>\n${tbody ? `<tbody>${tbody}</tbody>` : ''}</table>\n`;
        break;
      }
      case 'paragraph': {
        out += '<p>';
        if (b.checkbox) out += checkboxHTML(b.checkbox.checked);
        out += inlineBlock(b.text);
        out += '</p>\n';
        break;
      }
      case 'text': out += inlineBlock(b.text); break;
    }
  }
  return out;
}

// ---------- entry point ----------
// parse(markdown) -> HTML, byte-identical to marked.parse(markdown) with
// marked's default options (gfm on, breaks off, pedantic off).
export function parse(src) {
  src = src.replace(R.carriageReturn, '\n');
  links = Object.create(null);
  inLink = false; inRawBlock = false; linkEmitted = false;
  linkParenPossible = true; top = true;
  const blocks = blockTokens(src, []);
  return renderBlocks(blocks);
}
export default parse;
