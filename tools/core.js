/* ═══════════════════════════════════════════════════════════════════════════
   CORE — userscript parsing, customization engine & combination engine.
   Pure functions, no DOM. Used by the app UI and unit-tested in Node.
   ═══════════════════════════════════════════════════════════════════════════ */
var CORE = (function () {
  'use strict';

  var RUN_AT_ORDER = { 'document-start': 0, 'document-body': 1, 'document-end': 2, 'document-idle': 3 };

  function runAtRank(v) {
    return Object.prototype.hasOwnProperty.call(RUN_AT_ORDER, v) ? RUN_AT_ORDER[v] : 9;
  }

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function humanize(key) {
    var name = key.indexOf('.') > -1 ? key.split('.').slice(1).join(' › ') : key;
    return name
      .replace(/[_$]+/g, ' ')
      .replace(/([a-z\d])([A-Z])/g, '$1 $2')
      .trim()
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function slugify(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'script';
  }

  /* ── Header parsing ────────────────────────────────────────────────────── */

  function parseHeader(code) {
    var start = code.indexOf('// ==UserScript==');
    var endMarker = '// ==/UserScript==';
    var end = code.indexOf(endMarker);
    if (start === -1 || end === -1) return { meta: {}, body: code, headerRaw: '' };
    var headerBlock = code.slice(start, end + endMarker.length);
    var body = code.slice(end + endMarker.length).replace(/^\s*\n/, '');
    var meta = {};
    headerBlock.split('\n').forEach(function (line) {
      var m = line.match(/^\s*\/\/\s*@([\w:.-]+)\s*(.*)$/);
      if (m) {
        if (!meta[m[1]]) meta[m[1]] = [];
        meta[m[1]].push(m[2].trim());
      }
    });
    return { meta: meta, body: body, headerRaw: headerBlock };
  }

  function buildHeader(meta, order) {
    var lines = ['// ==UserScript=='];
    (order || ['name', 'namespace', 'version', 'description', 'author', 'icon', 'match',
      'exclude', 'include', 'grant', 'connect', 'require', 'run-at', 'noframes', 'license',
      'supportURL', 'homepage', 'updateURL', 'downloadURL'
    ]).forEach(function (tag) {
      var vals = meta[tag];
      if (!vals) return;
      (Array.isArray(vals) ? vals : [vals]).forEach(function (v) {
        lines.push('//' + (v === '' ? ' @' + tag : ' @' + tag + ' ' + v));
      });
    });
    lines.push('// ==/UserScript==');
    return lines.join('\n');
  }

  /* ── Literal scanning (find the exact span of a JS value) ──────────────── */

  // Returns { start, end } span of the value beginning at/after index i,
  // or null. Handles strings (all 3 quote styles), arrays, objects and
  // simple literals. Bracket matching is string-aware.
  function scanValueSpan(str, i) {
    while (i < str.length && /\s/.test(str.charAt(i))) i++;
    if (i >= str.length) return null;
    var start = i;
    var c = str.charAt(i);
    if (c === '\'' || c === '"' || c === '`') {
      i++;
      while (i < str.length) {
        if (str.charAt(i) === '\\') { i += 2; continue; }
        if (str.charAt(i) === c) return { start: start, end: i + 1 };
        i++;
      }
      return null; // unterminated
    }
    if (c === '[' || c === '{') {
      var open = c, close = (c === '[' ? ']' : '}');
      var depth = 0, inStr = null;
      while (i < str.length) {
        var ch = str.charAt(i);
        if (inStr) {
          if (ch === '\\') { i += 2; continue; }
          if (ch === inStr) inStr = null;
          i++;
          continue;
        }
        if (ch === '\'' || ch === '"' || ch === '`') { inStr = ch; i++; continue; }
        if (ch === '[' || ch === '{') depth++;
        else if (ch === ']' || ch === '}') {
          depth--;
          if (depth === 0) {
            if (ch === close) return { start: start, end: i + 1 };
            return null; // mismatched
          }
        }
        i++;
      }
      return null;
    }
    // Plain literal: number, boolean, regex, identifier… ends at delimiter.
    while (i < str.length) {
      var p = str.charAt(i);
      if (p === ',' || p === ';' || p === '}' || p === '\n' || p === ')') return { start: start, end: i };
      if (p === '/' && str.charAt(i + 1) === '/') return { start: start, end: i };
      i++;
    }
    return { start: start, end: i };
  }

  // Locate `const|let|var KEY =` and return { declEnd, span } or null.
  function findAssignment(code, key) {
    var re = new RegExp('(?:^|[;\\n])\\s*(?:const|let|var)\\s+' + escapeRegExp(key) + '\\s*=', 'g');
    var m = re.exec(code);
    if (!m) return null;
    var span = scanValueSpan(code, m.index + m[0].length);
    if (!span) return null;
    return { declEnd: m.index + m[0].length, span: span };
  }

  // Locate `prop:` inside `const OBJ = { … }` and return the value span.
  function findObjProp(code, dottedKey) {
    var parts = dottedKey.split('.');
    var objName = parts[0], prop = parts.slice(1).join('.');
    var objRe = new RegExp('(?:^|[;\\n])\\s*(?:const|let|var)\\s+' + escapeRegExp(objName) + '\\s*=\\s*\\{', 'g');
    var om = objRe.exec(code);
    if (!om) return null;
    var openIdx = code.indexOf('{', om.index + om[0].length - 1);
    var objSpan = scanValueSpan(code, openIdx);
    if (!objSpan) return null;
    var objText = code.slice(objSpan.start, objSpan.end);
    var propRe = new RegExp('(^|[{,\\n])\\s*' + escapeRegExp(prop) + '\\s*:', 'g');
    var pm = propRe.exec(objText);
    if (!pm) return null;
    var absStart = objSpan.start + pm.index + pm[0].length;
    var span = scanValueSpan(code, absStart);
    if (!span) return null;
    if (span.end > objSpan.end) return null; // ran outside the object
    return { declEnd: span.start, span: span };
  }

  function findValue(code, key) {
    return key.indexOf('.') > -1 ? findObjProp(code, key) : findAssignment(code, key);
  }

  // Raw source text currently assigned to `key` (or null).
  function getRawValue(code, key) {
    var f = findValue(code, key);
    return f ? code.slice(f.span.start, f.span.end) : null;
  }

  /* ── Lenient literal evaluation (trusted, embedded source only) ────────── */

  function evalLiteral(raw) {
    if (raw == null) return { ok: false };
    try {
      var v = Function('"use strict"; return (' + raw + ');')();
      return { ok: true, value: v };
    } catch (e) {
      return { ok: false };
    }
  }

  var COLOR_NAMES = {
    red: 1, blue: 1, green: 1, yellow: 1, orange: 1, purple: 1, pink: 1, white: 1, black: 1,
    gray: 1, grey: 1, silver: 1, gold: 1, cyan: 1, magenta: 1, teal: 1, navy: 1, maroon: 1,
    olive: 1, lime: 1, aqua: 1, ivory: 1, beige: 1, coral: 1, salmon: 1, tomato: 1, violet: 1,
    indigo: 1, turquoise: 1, khaki: 1, lavender: 1, plum: 1, tan: 1, wheat: 1, crimson: 1,
    lightgreen: 1, lightblue: 1, lightgray: 1, lightgrey: 1, darkred: 1, darkblue: 1,
    whitesmoke: 1, gainsboro: 1, firebrick: 1, dodgerblue: 1, aliceblue: 1
  };

  function looksLikeColor(v) {
    if (typeof v !== 'string') return false;
    var s = v.trim();
    if (/^#[0-9a-f]{3,8}$/i.test(s)) return true;
    if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,.+)?\)$/i.test(s)) return true;
    if (/^hsla?\(.+\)$/i.test(s)) return true;
    return Object.prototype.hasOwnProperty.call(COLOR_NAMES, s.toLowerCase());
  }

  // Classify a raw literal string into an editable field spec.
  // Returns null when the value should not be editable.
  // allowLong: permit big arrays/objects (used for curated keys).
  function classifyRaw(raw, allowLong) {
    if (raw == null) return null;
    var t = raw.trim();
    if (t === '') return null;
    if (/^\/.+\/[gimsuy]*$/.test(t)) return null; // regex literal — not editable
    if (/^-?\d+(\.\d+)?$/.test(t)) return { type: 'number', value: Number(t) };
    if (/^[\d\s+\-*/%().]+$/.test(t) && /\d/.test(t)) { // e.g. 24 * 60 * 60 * 1000
      var evn = evalLiteral(t);
      if (evn.ok && typeof evn.value === 'number') return { type: 'number', value: evn.value };
      return null;
    }
    if (t === 'true') return { type: 'boolean', value: true };
    if (t === 'false') return { type: 'boolean', value: false };
    if (/^null$|^undefined$/.test(t)) return null;
    if (/^(?:'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`)$/.test(t)) {
      var ev = evalLiteral(t);
      if (!ev.ok || typeof ev.value !== 'string') return null;
      var s = ev.value;
      if (looksLikeColor(s)) return { type: 'color', value: s };
      if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s) || s.length > 70) {
        return { type: s.length > 70 ? 'textarea' : 'text', value: s };
      }
      return { type: 'text', value: s };
    }
    if (t.charAt(0) === '[' || t.charAt(0) === '{') {
      if (t.length > (allowLong ? 20000 : 2000)) return null;
      var ev2 = evalLiteral(t);
      if (!ev2.ok) return null;
      var v = ev2.value;
      if (Array.isArray(v) && v.every(function (x) { return typeof x === 'string'; })) {
        return { type: 'list', value: v };
      }
      if (Array.isArray(v) || (v && typeof v === 'object')) {
        return { type: 'json', value: v };
      }
      return null;
    }
    return null; // identifiers, calls, member expressions, etc.
  }

  /* ── Customization detection ───────────────────────────────────────────── */

  // Extract `prop: literal` pairs textually from an object literal body.
  // Used when the object can't be evaluated as a whole (e.g. it references
  // runtime values like document.body) — scalar props are still surfaced.
  function objPropsFromText(code, objSpan) {
    var props = [];
    var objText = code.slice(objSpan.start, objSpan.end);
    var re = /(^|[{,\n])\s*([A-Za-z_$][\w$]*)\s*:\s*/g;
    var m;
    while ((m = re.exec(objText)) !== null) {
      var prop = m[2];
      var absStart = objSpan.start + m.index + m[0].length;
      var span = scanValueSpan(code, absStart);
      if (!span || span.end > objSpan.end) continue;
      var raw = code.slice(span.start, span.end);
      if (raw.length > 120) continue;
      var spec = classifyRaw(raw);
      if (!spec || spec.type === 'json' || spec.type === 'list') continue;
      props.push({ key: prop, type: spec.type, value: spec.value, raw: raw });
      re.lastIndex = m.index + m[0].length + (span.end - span.start);
    }
    return props;
  }

  // Scan a script for editable constants. Only near-top-level declarations
  // (indent ≤ 4 spaces) are surfaced to keep the panel relevant.
  // Returns [{key, type, value, raw}].
  function detectCustomizations(code) {
    var out = [];
    var seen = {};
    var re = /(?:^|[;\n])([ \t]*)(?:const|let|var)[ \t]+([A-Za-z_$][\w$]*)[ \t]*=/g;
    var m;
    while ((m = re.exec(code)) !== null) {
      var indent = m[1].length;
      var key = m[2];
      if (seen[key]) continue;
      if (/^(is|has|was|should|can|do|does)[A-Z_]/.test(key)) continue; // state flags, not config
      var span = scanValueSpan(code, m.index + m[0].length);
      if (!span) continue;
      var raw = code.slice(span.start, span.end);
      var isObj = raw.charAt(0) === '{';
      var isArr = raw.charAt(0) === '[';
      if (indent > 4) { re.lastIndex = span.end; continue; }
      // Plain scalars: only SCREAMING_SNAKE names (classic userscript CONFIG
      // constants). Arrays/objects of any casing are configuration-shaped.
      var screaming = /^[A-Z][A-Z0-9_]*$/.test(key);
      if (!screaming && !isObj && !isArr) { re.lastIndex = span.end; continue; }
      var spec = classifyRaw(raw, false);
      seen[key] = true;
      if (spec) {
        out.push({ key: key, type: spec.type, value: spec.value, raw: raw });
        // Evaluatable object literal: surface each scalar property as dotted key.
        if (spec.type === 'json' && !Array.isArray(spec.value)) {
          Object.keys(spec.value).forEach(function (prop) {
            var pv = spec.value[prop];
            var dotted = key + '.' + prop;
            if (typeof pv === 'number') out.push({ key: dotted, type: 'number', value: pv, raw: null });
            else if (typeof pv === 'boolean') out.push({ key: dotted, type: 'boolean', value: pv, raw: null });
            else if (typeof pv === 'string') {
              out.push({ key: dotted, type: looksLikeColor(pv) ? 'color' : 'text', value: pv, raw: null });
            }
          });
        }
      } else if (isObj) {
        // Non-evaluatable object (references runtime values): still offer
        // its scalar properties as dotted keys.
        objPropsFromText(code, span).forEach(function (p) {
          out.push({ key: key + '.' + p.key, type: p.type, value: p.value, raw: p.raw });
        });
      }
      re.lastIndex = span.end;
    }
    return out;
  }

  /* ── Applying customizations ───────────────────────────────────────────── */

  function literalFor(spec) {
    var type = spec.type, v = spec.value;
    switch (type) {
      case 'number': return String(Number(v));
      case 'boolean': return v ? 'true' : 'false';
      case 'color':
      case 'text':
      case 'textarea':
      case 'select': return JSON.stringify(String(v));
      case 'list': return JSON.stringify((v || []).map(String));
      case 'json': return JSON.stringify(v, null, 2);
      default: return null;
    }
  }

  // Replace the value assigned to `key` in `code`. Returns new code (or the
  // original if the key can't be located / literal can't be built).
  function applyValue(code, key, spec) {
    var lit = literalFor(spec);
    if (lit == null) return code;
    var f = findValue(code, key);
    if (!f) return code;
    return code.slice(0, f.span.start) + lit + code.slice(f.span.end);
  }

  // Apply many {key, spec} entries at once.
  function applyValues(code, entries) {
    var out = code;
    entries.forEach(function (e) { out = applyValue(out, e.key, e.spec); });
    return out;
  }

  // Same but per-script bodies: entries are {bodyIndex, key, spec}.
  function applyValuesToMany(bodies, entries) {
    var out = bodies.slice();
    entries.forEach(function (e) {
      if (out[e.bodyIndex] != null) out[e.bodyIndex] = applyValue(out[e.bodyIndex], e.key, e.spec);
    });
    return out;
  }

  /* ── Combination engine ────────────────────────────────────────────────── */

  function pushUnique(arr, val) {
    var lower = String(val).toLowerCase();
    if (!arr.some(function (x) { return String(x).toLowerCase() === lower; })) arr.push(val);
  }

  // scripts: [{ title, code }] in selection order. opts: { name, version, perScriptValues }
  // perScriptValues (optional): array (same length as scripts) of [{key, spec}]
  // applied to that script's body before wrapping.
  function combineScripts(scripts, opts) {
    opts = opts || {};
    var merged = { match: [], exclude: [], include: [], grant: [], connect: [], require: [] };
    var runAt = null, authors = [], titles = [], icon = '', noframes = false, ns = '';
    var parsed = scripts.map(function (s) { return parseHeader(s.code); });

    parsed.forEach(function (p) {
      ['match', 'exclude', 'include', 'connect', 'require'].forEach(function (tag) {
        (p.meta[tag] || []).forEach(function (v) { if (v) pushUnique(merged[tag], v); });
      });
      (p.meta['grant'] || []).forEach(function (v) { if (v) pushUnique(merged.grant, v); });
      (p.meta['run-at'] || []).forEach(function (v) {
        if (!runAt || runAtRank(v) < runAtRank(runAt)) runAt = v;
      });
      (p.meta['author'] || []).forEach(function (v) { if (v) pushUnique(authors, v); });
      (p.meta['namespace'] || []).forEach(function (v) { if (v && !ns) ns = v; });
      (p.meta['icon'] || []).forEach(function (v) { if (v && !icon) icon = v; });
      if (p.meta['noframes']) noframes = true;
    });

    var grants = merged.grant.slice();
    var hasReal = grants.some(function (g) { return g !== 'none'; });
    if (hasReal) grants = grants.filter(function (g) { return g !== 'none'; });
    if (!grants.length) grants = ['none'];

    var titles = scripts.map(function (s, i) { return s.title || ('Script ' + (i + 1)); });
    var name = opts.name || ('Combined: ' + titles.join(' + '));
    var header = {
      name: [name],
      namespace: [ns || 'http://tampermonkey.net/'],
      version: [opts.version || '1.0.0'],
      description: ['Bundle of ' + scripts.length + ' scripts: ' + titles.join(' \u00b7 ')].concat(
        (opts.description ? [opts.description] : [])),
      match: merged.match,
      exclude: merged.exclude,
      include: merged.include,
      grant: grants,
      connect: merged.connect,
      require: merged.require
    };
    if (authors.length) header.author = authors;
    if (icon) header.icon = [icon];
    if (runAt) header['run-at'] = [runAt];
    if (noframes) header.noframes = [''];
    // NOTE: @updateURL/@downloadURL intentionally omitted so Tampermonkey
    // never auto-replaces a customized bundle with an upstream script.

    var sections = [];
    scripts.forEach(function (s, i) {
      var body = parsed[i].body.replace(/^\s*\n/, '');
      if (opts.perScriptValues && opts.perScriptValues[i]) {
        body = applyValues(body, opts.perScriptValues[i]);
      }
      var banner = '/* ' + Array(74).join('═').slice(0, 74) + '\n' +
        '   \u2714 ' + titles[i] + '\n' +
        '   ' + Array(74).join('─').slice(0, 71) + ' */';
      sections.push(banner + '\n(function () {\n' + body + '\n})();\n');
    });

    var notes = [
      '// ─────────────────────────────────────────────────────────────────────',
      '// Combined bundle generated by Byte-Sized Toolbox.',
      '// Each script is wrapped in its own IIFE so top-level variables never collide.',
      '// Duplicate match / grant / connect / require directives were merged.',
      '// Update + download URLs were removed so auto-update cannot overwrite this bundle.',
      '// ─────────────────────────────────────────────────────────────────────'
    ].join('\n');

    var code = buildHeader(header) + '\n\n' + notes + '\n\n' + sections.join('\n');
    var warnings = [];
    if (runAt && runAt !== 'document-idle') {
      warnings.push('Run-at set to "' + runAt + '" (the earliest of the selected scripts).');
    }
    return {
      code: code,
      meta: header,
      runAt: runAt,
      warnings: warnings,
      matchCount: merged.match.length,
      grantCount: grants.length
    };
  }

  /* ── Export helpers ────────────────────────────────────────────────────── */

  // Prepare a single script for export: apply customizations, and strip
  // @updateURL/@downloadURL when the code has been modified (so auto-update
  // can never clobber the customized copy).
  function exportSingle(script, entries) {
    var code = script.code;
    var modified = false;
    if (entries && entries.length) {
      var before = code;
      code = applyValues(code, entries);
      modified = code !== before;
    }
    if (modified) {
      code = code.replace(/^\s*\/\/\s*@updateURL\s+.*$/gm, '')
        .replace(/^\s*\/\/\s*@downloadURL\s+.*$/gm, '')
        .replace(/\n{3,}/g, '\n\n');
    }
    return { code: code, modified: modified };
  }

  /* ── Light syntax highlighting (returns HTML) ──────────────────────────── */

  var TOKEN_RE = new RegExp(
    '(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)' +                    // 1 comment
    '|(\'(?:\\\\.|[^\'\\\\\\n])*\'|"(?:\\\\.|[^"\\\\\\n])*"' +     // 2 string
    '|`(?:\\\\.|[^`\\\\])*`)' +
    '|\\b(function|return|const|let|var|if|else|for|while|new|typeof|class|async|await|of|in|try|catch|finally|switch|case|default|break|continue|do|throw|delete|instanceof|void|this|null|true|false|undefined)\\b' + // 3 keyword
    '|(@[\\w:.-]+)' +                                              // 4 userscript tag
    '|\\b(\\d+(?:\\.\\d+)?)\\b',                                   // 5 number
    'g');

  function highlight(code) {
    var out = [], last = 0, m;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(code)) !== null) {
      if (m.index > last) out.push(escapeHtml(code.slice(last, m.index)));
      var cls = m[1] ? 'tk-cm' : m[2] ? 'tk-st' : m[3] ? 'tk-kw' : m[4] ? 'tk-tag' : 'tk-nm';
      out.push('<span class="' + cls + '">' + escapeHtml(m[0]) + '</span>');
      last = m.index + m[0].length;
    }
    out.push(escapeHtml(code.slice(last)));
    return out.join('');
  }

  return {
    escapeRegExp: escapeRegExp,
    escapeHtml: escapeHtml,
    humanize: humanize,
    slugify: slugify,
    parseHeader: parseHeader,
    buildHeader: buildHeader,
    findValue: findValue,
    getRawValue: getRawValue,
    classifyRaw: classifyRaw,
    detectCustomizations: detectCustomizations,
    applyValue: applyValue,
    applyValues: applyValues,
    applyValuesToMany: applyValuesToMany,
    combineScripts: combineScripts,
    exportSingle: exportSingle,
    evalLiteral: evalLiteral,
    looksLikeColor: looksLikeColor,
    literalFor: literalFor,
    highlight: highlight
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CORE;
