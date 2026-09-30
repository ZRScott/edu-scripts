/* Build: assembles the single-file app from meta.json + decoded sources + core.js + app_ui.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const CORE = require('./core.js');

const TOOLS = '/home/user/tools';
const SOURCES = path.join(TOOLS, 'sources');
const OUT = '/home/user/teacher-script-toolbox.html';
const meta = JSON.parse(fs.readFileSync(path.join(TOOLS, 'meta.json'), 'utf8'));
const backup = JSON.parse(fs.readFileSync('/home/user/uploads/tampermonkey-backup-chrome-2026-09-30T20-23-03-766Z.txt', 'utf8'));

// backup lookup by @name
const byName = {};
for (const s of backup.scripts) {
  const src = Buffer.from(s.source, 'base64').toString('utf8');
  const nm = (src.match(/@name\s+(.*)/) || [])[1].trim();
  byName[nm] = { enabled: s.enabled, position: s.position };
}

function tplLiteral(s) {
  // NOTE: template literals preserve every character — never re-indent the
  // contents, or the embedded script source would be corrupted.
  return '`' + s
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
    .replace(/<\/(script)/gi, '<\\/$1') + '`';
}

const entries = meta.scripts.map(m => {
  const code = fs.readFileSync(path.join(SOURCES, m.file), 'utf8');
  if (code.indexOf('// ==UserScript==') === -1) throw new Error('no header: ' + m.file);
  if (/<\/script/i.test(code)) throw new Error('</script in source — needs escaping: ' + m.file);
  const p = CORE.parseHeader(code);
  const title = (p.meta.name || [])[0] || m.id;
  const version = (p.meta.version || [])[0] || '';
  const matches = p.meta.match || [];
  const bk = byName[title] || {};
  // enrich customizations with defaults extracted from source
  const customizations = (m.customizations || []).map(c => {
    const raw = CORE.getRawValue(code, c.key);
    const spec = raw != null ? CORE.classifyRaw(raw, true) : null;
    const out = { key: c.key, label: c.label || CORE.humanize(c.key) };
    if (c.type) out.type = c.type;
    if (c.hint) out.hint = c.hint;
    if (c.options) out.options = c.options;
    out.default = spec ? spec.value : (raw != null ? raw : '');
    return out;
  });
  return {
    id: m.id,
    title,
    description: m.description,
    version,
    domain: m.domain,
    matchUrl: matches[0] || '',
    matches,
    grants: p.meta.grant || [],
    connects: p.meta.connect || [],
    runAt: (p.meta['run-at'] || ['document-idle'])[0],
    enabled: bk.enabled === true,
    position: bk.position != null ? bk.position : 999,
    tags: m.tags || [],
    customizations,
    code
  };
}).sort((a, b) => a.position - b.position);

// ── assemble SCRIPTS_DATA source text ──────────────────────────────────────
const dataLines = ['var SCRIPTS_DATA = ['];
for (const e of entries) {
  const parts = [];
  parts.push(`id: ${JSON.stringify(e.id)}`);
  parts.push(`title: ${JSON.stringify(e.title)}`);
  parts.push(`description: ${JSON.stringify(e.description)}`);
  if (e.version) parts.push(`version: ${JSON.stringify(e.version)}`);
  parts.push(`domain: ${JSON.stringify(e.domain)}`);
  parts.push(`matchUrl: ${JSON.stringify(e.matchUrl)}`);
  parts.push(`matches: ${JSON.stringify(e.matches)}`);
  parts.push(`grants: ${JSON.stringify(e.grants)}`);
  if (e.connects.length) parts.push(`connects: ${JSON.stringify(e.connects)}`);
  parts.push(`runAt: ${JSON.stringify(e.runAt)}`);
  parts.push(`enabled: ${e.enabled}`);
  parts.push(`tags: ${JSON.stringify(e.tags)}`);
  if (e.customizations.length) {
    parts.push(`customizations: ${JSON.stringify(e.customizations, null, 2).replace(/\n/g, '\n  ')}`);
  } else {
    parts.push(`customizations: []`);
  }
  parts.push(`code: ${tplLiteral(e.code)}`);
  dataLines.push('  {\n    ' + parts.join(',\n    ') + '\n  },');
}
dataLines.push('];');

const core = fs.readFileSync(path.join(TOOLS, 'core.js'), 'utf8')
  .replace(/\nif \(typeof module[^\n]+\n?$/, '\n');
const app = fs.readFileSync(path.join(TOOLS, 'app_ui.js'), 'utf8');
const template = fs.readFileSync(path.join(TOOLS, 'template.html'), 'utf8');

const html = template
  .replace('/*__SCRIPTS_DATA__*/', () => dataLines.join('\n'))
  .replace('/*__CORE__*/', () => core)
  .replace('/*__APP__*/', () => app);

fs.writeFileSync(OUT, html);

// ── verification ────────────────────────────────────────────────────────────
// 1) the emitted inline script must compile
const mScript = html.match(/<script>([\s\S]*)<\/script>/);
if (!mScript) throw new Error('no inline script found');
try {
  new vm.Script(mScript[1]);
} catch (e) {
  throw new Error('inline script does not compile: ' + e.message);
}
// 2) SCRIPTS_DATA parses and has all entries with intact code
const ctx = { window: {} };
const sandbox = vm.createContext(ctx);
const dataOnly = mScript[1].slice(0, mScript[1].indexOf('/* ═══════════════════════════════════════════════════════════════════════════\n   3) APP'));
vm.runInContext(dataOnly + '\n; var __N = SCRIPTS_DATA.length;', sandbox);
const count = vm.runInContext('__N', sandbox);
let codeOk = 0;
for (let i = 0; i < count; i++) {
  const orig = entries[i].code;
  const got = vm.runInContext('SCRIPTS_DATA[' + i + '].code', sandbox);
  if (got === orig) codeOk++;
  else throw new Error('code roundtrip mismatch at entry ' + i + ' (' + entries[i].id + ')');
}
console.log('✔ built', OUT);
console.log('  size:', (fs.statSync(OUT).size / 1024).toFixed(1), 'KB');
console.log('  scripts:', count, '| code roundtrip ok:', codeOk + '/' + count);
console.log('  domains:', JSON.stringify(entries.reduce((a, e) => { a[e.domain] = (a[e.domain] || 0) + 1; return a; }, {})));
console.log('  customizations total:', entries.reduce((a, e) => a + e.customizations.length, 0));
// 3) no stray markers
if (/__SCRIPTS_DATA__|__CORE__|__APP__/.test(html)) throw new Error('unreplaced marker!');
console.log('✔ all checks passed');
