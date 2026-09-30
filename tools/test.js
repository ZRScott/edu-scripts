const fs = require('fs');
const path = require('path');
const vm = require('vm');
const CORE = require('./core.js');
const meta = JSON.parse(fs.readFileSync('/home/user/tools/meta.json', 'utf8'));
const backup = JSON.parse(fs.readFileSync('/home/user/uploads/tampermonkey-backup-chrome-2026-09-30T20-23-03-766Z.txt', 'utf8'));

// Build script records the same way build.js will (single source of truth test)
const SOURCES = '/home/user/tools/sources';
const byName = {};
for (const s of backup.scripts) {
  const src = Buffer.from(s.source, 'base64').toString('utf8');
  const nm = (src.match(/@name\s+(.*)/) || [])[1].trim();
  byName[nm] = { src, enabled: s.enabled, position: s.position, origMatches: (s.options && s.options.override && s.options.override.orig_matches) || [] };
}
const scripts = meta.scripts.map(m => {
  const src = fs.readFileSync(path.join(SOURCES, m.file), 'utf8');
  const nm = (src.match(/@name\s+(.*)/) || [])[1].trim();
  const rec = byName[nm];
  return { ...m, title: nm, code: src, enabled: rec ? rec.enabled : null, origMatches: rec ? rec.origMatches : [] };
});

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('  ✗ FAIL:', msg); } };

/* 1 ─ parseHeader: extracted @match must equal backup orig_matches */
console.log('1. parseHeader vs backup orig_matches');
for (const s of scripts) {
  const p = CORE.parseHeader(s.code);
  ok(JSON.stringify(p.meta.match || []) === JSON.stringify(s.origMatches),
    s.id + ' @match equals backup: hdr=' + JSON.stringify(p.meta.match) + ' backup=' + JSON.stringify(s.origMatches));
  ok(p.body.length > 0, s.id + ' has body');
}

/* 2 ─ curated customizations resolve + classify */
console.log('2. curated customizations resolve in source');
for (const s of scripts) {
  for (const c of s.customizations) {
    const raw = CORE.getRawValue(s.code, c.key);
    ok(raw !== null, s.id + ' :: ' + c.key + ' found in source');
    if (raw == null) continue;
    const spec = CORE.classifyRaw(raw);
    ok(spec !== null, s.id + ' :: ' + c.key + ' classifiable (raw: ' + raw.slice(0, 40) + ')');
    if (!spec) continue;
    if (c.type && c.type !== 'select') {
      const compatible = spec.type === c.type || (c.type === 'json' && spec.type === 'list');
      ok(compatible, s.id + ' :: ' + c.key + ' type match: curated=' + c.type + ' detected=' + spec.type + ' raw=' + raw.slice(0, 60));
    }
    if (c.type === 'select') {
      ok(spec.type === 'text' || spec.type === 'select', s.id + ' :: ' + c.key + ' select-of-string ok');
      ok(c.options.includes(spec.value), s.id + ' :: ' + c.key + ' default in options: ' + spec.value);
    }
  }
}

/* 3 ─ applyValue with modified values → still valid JS */
console.log('3. applyValue produces compilable JS');
function sampleValue(type, cur, current) {
  switch (type) {
    case 'number': return 999;
    case 'boolean': return typeof current === 'boolean' ? !current : true;
    case 'color': return '#123456';
    case 'text': return 'ZZ_TEST_ZZ';
    case 'textarea': return 'Long test \u201cmessage\u201d with "quotes" and \\ backslash';
    case 'select': return cur.options[0];
    case 'list': return ['aaa', 'bbb', 'ccc'];
    case 'json': return [{ text: 'T', color: '#abcdef', hide: true, n: 3 }, { text: 'U' }];
    default: return 'X';
  }
}
for (const s of scripts) {
  for (const c of s.customizations) {
    const cur0 = CORE.classifyRaw(CORE.getRawValue(s.code, c.key), true);
    const spec = { type: c.type === 'select' ? 'select' : c.type, value: sampleValue(c.type, c, cur0 && cur0.value) };
    const out = CORE.applyValue(s.code, c.key, spec);
    ok(out !== s.code, s.id + ' :: ' + c.key + ' changed the code');
    try { new vm.Script(out); pass++; } catch (e) { fail++; console.log('  ✗ COMPILE FAIL', s.id, c.key, e.message.slice(0, 120)); }
    // round-trip: read the value back out of the modified code
    const back = CORE.getRawValue(out, c.key);
    ok(back !== null, s.id + ' :: ' + c.key + ' re-readable after apply');
  }
}

/* 4 ─ detectCustomizations runs everywhere; curated keys ⊆ detected ∪ curated */
console.log('4. detectCustomizations');
for (const s of scripts) {
  let det;
  try { det = CORE.detectCustomizations(s.code); pass++; } catch (e) { fail++; console.log('  ✗ detect crash', s.id, e.message); continue; }
  const keys = new Set(det.map(d => d.key));
  for (const c of s.customizations) {
    const base = c.key.split('.')[0];
    const screaming = /^[A-Z][A-Z0-9_]*$/.test(base);
    if (!screaming) continue; // lowercase keys are surfaced via curation, not auto-detect
    ok(keys.has(base) || [...keys].some(k => k.startsWith(base + '.')),
      s.id + ' :: auto-detect sees ' + c.key + ' (detected: ' + [...keys].slice(0, 8).join(', ') + ')');
  }
  // every simple detected key must be applyable and compilable
  for (const d of det.filter(d => d.key.indexOf('.') === -1).slice(0, 200)) {
    const out = CORE.applyValue(s.code, d.key, { type: d.type, value: d.value });
    try { new vm.Script(out); pass++; } catch (e) { fail++; console.log('  ✗ AUTO-APPLY COMPILE FAIL', s.id, d.key, e.message.slice(0, 120)); }
  }
}

/* 5 ─ combineScripts on every domain group + all together */
console.log('5. combineScripts');
const domains = [...new Set(scripts.map(s => s.domain))];
for (const dom of domains.concat(['ALL'])) {
  const group = dom === 'ALL' ? scripts : scripts.filter(s => s.domain === dom);
  if (group.length < 1) continue;
  const res = CORE.combineScripts(group.map(s => ({ title: s.title, code: s.code })), { name: 'Test Bundle (' + dom + ')' });
  // valid JS
  try { new vm.Script(res.code); pass++; } catch (e) { fail++; console.log('  ✗ COMBINE COMPILE FAIL', dom, e.message.slice(0, 140)); }
  // deduped matches
  const p = CORE.parseHeader(res.code);
  const allMatches = group.flatMap(s => CORE.parseHeader(s.code).meta.match || []);
  const uniq = new Set(allMatches.map(m => m.toLowerCase()));
  ok(p.meta.match.length === uniq.size, dom + ' match dedupe: ' + p.meta.match.length + ' vs uniq ' + uniq.size);
  // no duplicate @match lines at all
  const matchLines = res.code.match(/\/\/\s*@match[^\n]*/g) || [];
  ok(matchLines.length === uniq.size, dom + ' @match line count ' + matchLines.length + ' == uniq ' + uniq.size);
  // grants: none dropped if any real
  const allGrants = group.flatMap(s => CORE.parseHeader(s.code).meta.grant || []);
  const hasReal = allGrants.some(g => g !== 'none');
  const combinedGrants = p.meta.grant || [];
  ok(!hasReal || !combinedGrants.includes('none'), dom + ' grant none dropped');
  ok(new Set(combinedGrants.map(g => g.toLowerCase())).size === combinedGrants.length, dom + ' grants unique');
  // run-at earliest
  const runAts = group.map(s => (CORE.parseHeader(s.code).meta['run-at'] || ['document-idle'])[0]);
  const earliest = runAts.sort((a, b) => (CORE.parseHeader && 0) || ({ 'document-start': 0, 'document-body': 1, 'document-end': 2, 'document-idle': 3 }[a] ?? 9) - ({ 'document-start': 0, 'document-body': 1, 'document-end': 2, 'document-idle': 3 }[b] ?? 9))[0];
  ok((p.meta['run-at'] || [])[0] === earliest, dom + ' run-at earliest: got ' + (p.meta['run-at'] || [])[0] + ' want ' + earliest);
  // every body wrapped in IIFE: count banners == group size
  const banners = (res.code.match(/^ {3}✔ /gm) || []).length;
  ok(banners === group.length, dom + ' each script present (' + banners + '/' + group.length + ')');
  // all titles present in combined description and banners
  for (const g of group) {
    ok(res.code.includes('Bundle of ' + group.length + ' scripts:') && (res.code.includes(g.title)),
      dom + ' title present: ' + g.title);
  }
  // no updateURL/downloadURL header lines (the explanatory note may mention them in prose)
  ok(!/^\s*\/\/\s*@(updateURL|downloadURL)\s/m.test(res.code), dom + ' update URLs stripped');
  // per-script values applied inside combined
  if (group[0].customizations.length) {
    const c0 = group[0].customizations[0];
    const withVals = CORE.combineScripts(group.map(s => ({ title: s.title, code: s.code })), {
      name: 'Test Bundle vals',
      perScriptValues: group.map(s => s.customizations.slice(0, 1).map(c => ({ key: c.key, spec: { type: c.type === 'select' ? 'select' : c.type, value: sampleValue(c.type, c) } })))
    });
    ok(!group[0].customizations[0] || withVals.code !== res.code, dom + ' per-script values applied');
    try { new vm.Script(withVals.code); pass++; } catch (e) { fail++; console.log('  ✗ COMBINE+VALS COMPILE FAIL', dom, e.message.slice(0, 140)); }
  }
}

/* 6 ─ exportSingle strips update URLs only when modified */
console.log('6. exportSingle');
const suite = scripts.find(s => s.id === 'google-voice-suite');
const clean = CORE.exportSingle(suite, []);
ok(/@updateURL/.test(clean.code) === true, 'unmodified keeps @updateURL');
const dirty = CORE.exportSingle(suite, [{ key: 'STORAGE_KEY', spec: { type: 'text', value: 'xx' } }]);
ok(/@updateURL/.test(dirty.code) === false, 'modified strips @updateURL');
ok(/xx/.test(dirty.code), 'modified value present');

console.log('\n════════ RESULT: ' + pass + ' passed, ' + fail + ' failed ════════');
process.exit(fail ? 1 : 0);
