(function () {
  'use strict';
  var C = CORE;
  var $ = function (id) { return document.getElementById(id); };

  /* ── Domain presentation metadata (theme-tuned accents) ───────────────── */
  var DOMAIN_META = {
    'Connexus': { emoji: '🏫', color: '#7fd4ff' },
    'Google Voice': { emoji: '📞', color: '#17c3a6' },
    'Google Chat': { emoji: '💬', color: '#f2a0ff' },
    'Gmail': { emoji: '✉️', color: '#ff8fa3' },
    'Labster': { emoji: '🧪', color: '#a8e6a3' },
    'Utilities': { emoji: '🧰', color: '#ffb43d' }
  };
  function domMeta(d) { return DOMAIN_META[d] || { emoji: '🧩', color: '#4f46e5' }; }
  function byId(id) { for (var i = 0; i < SCRIPTS_DATA.length; i++) if (SCRIPTS_DATA[i].id === id) return SCRIPTS_DATA[i]; return null; }

  /* ── App state ─────────────────────────────────────────────────────────── */
  var state = { query: '', domain: 'All', sort: 'default', selected: new Set() };
  var sessionValues = {};   // scriptId -> { key: {type, value} }  (survives modal close)
  var modal = null;         // currently open modal model
  var codeTimer = null;

  var cssEsc = (typeof CSS !== 'undefined' && CSS.escape)
    ? function (s) { return CSS.escape(s); }
    : function (s) { return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); };

  /* ── Small helpers ─────────────────────────────────────────────────────── */
  function esc(s) { return C.escapeHtml(s == null ? '' : s); }
  function sameValue(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  function copyText(text, okMsg) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      toast(ok ? okMsg : 'Copy blocked here — open the file in your browser, or select the code and press Ctrl/Cmd+C');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback);
    } else fallback();
  }

  function downloadUserJs(name, code) {
    try {
      var fname = C.slugify(name) + '.user.js';
      var blob = new Blob([code], { type: 'text/javascript;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      toast('⬇ ' + fname + ' — open it (or drag it onto a Chrome tab) so Tampermonkey offers to install');
    } catch (e) {
      toast('Downloads are blocked in this preview — open the HTML file directly in your browser');
    }
  }

  /* ── Field model ───────────────────────────────────────────────────────── */
  // Merge curated customizations (SCRIPTS_DATA) with auto-detected constants.
  function buildFieldsFor(s) {
    var out = [];
    var seen = {};
    (s.customizations || []).forEach(function (c) {
      seen[c.key] = true;
      var raw = C.getRawValue(s.code, c.key);
      var spec = raw != null ? C.classifyRaw(raw, true) : null;
      var defValue = spec ? spec.value : (c.default !== undefined ? c.default : '');
      var type = c.type || (spec ? spec.type : 'text');
      if (type === 'json' && spec && spec.type === 'list') type = 'list';
      if (type === 'select' && c.options) {
        if (typeof defValue !== 'string' || c.options.indexOf(defValue) === -1) defValue = c.options[0];
      }
      out.push({
        key: c.key, label: c.label || C.humanize(c.key), type: type, hint: c.hint || null,
        options: c.options || null, defValue: defValue, auto: false
      });
    });
    C.detectCustomizations(s.code).forEach(function (d) {
      if (seen[d.key]) return;
      seen[d.key] = true;
      out.push({
        key: d.key, label: C.humanize(d.key), type: d.type, hint: null,
        options: null, defValue: d.value, auto: true
      });
    });
    return out;
  }

  // Only fields whose current value differs from the default get applied —
  // keeps the exported code as close to the original as possible.
  function changedEntries(fields, values) {
    var out = [];
    fields.forEach(function (f) {
      var v = values[f.key];
      if (v == null) return;
      if (sameValue(v.value, f.defValue)) return;
      out.push({ key: f.key, spec: { type: f.type, value: v.value } });
    });
    return out;
  }

  function scriptChangedCount(s) {
    var vals = sessionValues[s.id];
    if (!vals) return 0;
    return changedEntries(buildFieldsFor(s), vals).length;
  }

  /* ── Export builders ───────────────────────────────────────────────────── */
  function exportSingleScript(s) {
    var fields = buildFieldsFor(s);
    var vals = sessionValues[s.id] || {};
    return C.exportSingle(s, changedEntries(fields, vals));
  }

  function currentExport() {
    if (!modal) return { code: '', name: 'script' };
    if (modal.mode === 'single') {
      var s = byId(modal.id);
      return { code: exportSingleScript(s).code, name: s.title, modified: scriptChangedCount(s) > 0 };
    }
    var scripts = [], per = [];
    modal.groups.forEach(function (g) {
      scripts.push({ title: g.script.title, code: g.script.code });
      var vals = {};
      Object.keys(modal.values).forEach(function (vk) {
        if (vk.indexOf(g.script.id + '::') === 0) vals[vk.slice(g.script.id.length + 2)] = modal.values[vk];
      });
      per.push(changedEntries(g.fields, vals));
    });
    var res = C.combineScripts(scripts, { name: modal.name, perScriptValues: per });
    return { code: res.code, name: modal.name, modified: true, warnings: res.warnings, res: res };
  }

  /* ── Catalog rendering ─────────────────────────────────────────────────── */
  function domainCounts() {
    var m = new Map();
    SCRIPTS_DATA.forEach(function (s) { m.set(s.domain, (m.get(s.domain) || 0) + 1); });
    return Array.from(m.entries()).sort(function (a, b) { return b[1] - a[1] || a[0].localeCompare(b[0]); });
  }

  function renderStats() {
    var active = SCRIPTS_DATA.filter(function (s) { return s.enabled; }).length;
    var customizable = SCRIPTS_DATA.filter(function (s) { return (s.customizations || []).length > 0; }).length;
    var settings = SCRIPTS_DATA.reduce(function (a, s) { return a + (s.customizations || []).length; }, 0);
    $('headstats').innerHTML =
      '<div class="hstat"><div class="num">' + SCRIPTS_DATA.length + '</div><div class="lbl">scripts cataloged</div></div>' +
      '<div class="hstat"><div class="num">' + domainCounts().length + '</div><div class="lbl">domains covered</div></div>' +
      '<div class="hstat"><div class="num"><em>' + settings + '+</em></div><div class="lbl">live settings</div></div>' +
      '<div class="hstat"><div class="num">' + active + '</div><div class="lbl">active in backup</div></div>';
  }

  function renderTabs() {
    var html = '';
    function tab(label, key, count, emoji) {
      var on = state.domain === key;
      html += '<button class="tab' + (on ? ' active' : '') + '" data-domain="' + esc(key) + '">' +
        (emoji ? emoji + ' ' : '') + esc(label) +
        ' <span class="cnt">' + count + '</span></button>';
    }
    tab('All', 'All', SCRIPTS_DATA.length, '✨');
    domainCounts().forEach(function (d) {
      var dm = domMeta(d[0]);
      tab(d[0], d[0], d[1], dm.emoji);
    });
    $('tabs').innerHTML = html;
  }

  function filteredScripts() {
    var q = state.query.trim().toLowerCase();
    var list = SCRIPTS_DATA.filter(function (s) {
      if (state.domain !== 'All' && s.domain !== state.domain) return false;
      if (!q) return true;
      var hay = [s.title, s.description, s.domain, s.matchUrl, s.id].concat(s.tags || []).join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    if (state.sort === 'az') list = list.slice().sort(function (a, b) { return a.title.localeCompare(b.title); });
    else if (state.sort === 'za') list = list.slice().sort(function (a, b) { return b.title.localeCompare(a.title); });
    else if (state.sort === 'domain') list = list.slice().sort(function (a, b) {
      return a.domain.localeCompare(b.domain) || a.title.localeCompare(b.title);
    });
    return list;
  }

  function renderGrid() {
    var list = filteredScripts();
    var q = state.query.trim();
    $('resultline').innerHTML = '// showing <b>' + list.length + '</b> of ' + SCRIPTS_DATA.length + ' scripts' +
      (state.domain !== 'All' ? ' · ' + esc(state.domain) : '') + (q ? ' · matching “' + esc(q) + '”' : '');
    if (!list.length) {
      $('grid').innerHTML = '<div class="empty"><div class="big">🔍</div><b>No scripts match.</b><br>' +
        '<button class="ghostbtn" style="margin-top:14px" id="clearsearch">Clear search &amp; filters</button></div>';
      var cs = $('clearsearch');
      if (cs) cs.onclick = function () { state.query = ''; state.domain = 'All'; $('search').value = ''; renderTabs(); renderGrid(); };
      return;
    }
    var html = '';
    list.forEach(function (s) {
      var dm = domMeta(s.domain);
      var on = state.selected.has(s.id);
      var edited = scriptChangedCount(s) > 0;
      var matches = s.matches && s.matches.length ? s.matches : [s.matchUrl];
      var matchTitle = matches.join('\n');
      html += '<article class="card' + (on ? ' selected' : '') + '" data-id="' + esc(s.id) + '">' +
        '<div class="card-top">' +
          '<span class="domchip" style="--dc:' + dm.color + '">' + dm.emoji + ' ' + esc(s.domain) + '</span>' +
          '<span class="status"><span class="dot" style="background:' + (s.enabled ? 'var(--mint)' : '#5d7f8a') + '"></span>' + (s.enabled ? 'active' : 'paused') + '</span>' +
          '<button class="pick' + (on ? ' on' : '') + '" data-act="pick" title="Select for combining" aria-label="Select for combining">✓</button>' +
        '</div>' +
        '<h3>' + esc(s.title) + '</h3>' +
        '<p class="desc" title="' + esc(s.description) + '">' + esc(s.description) + '</p>' +
        '<div class="matchrow" title="' + esc(matchTitle) + '"><span class="globe">🌐</span><code>' + esc(s.matchUrl) + (matches.length > 1 ? ' +' + (matches.length - 1) + ' more' : '') + '</code></div>' +
        '<div class="tagrow">' + (s.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
        '<div class="card-foot">' +
          '<button class="btn btn-primary sheen-btn" data-act="customize">⚙ Customize</button>' +
          '<span style="flex:1"></span>' +
          (edited ? '<span class="editedbadge" title="You have unsaved customizations for this script (applied on copy/download)">EDITED</span>' : '') +
          '<button class="iconbtn" data-act="copy" title="Copy userscript code">⧉</button>' +
          '<button class="iconbtn" data-act="download" title="Download .user.js">⬇</button>' +
        '</div>' +
        '</article>';
    });
    $('grid').innerHTML = html;
    updateSelbar();
  }

  /* ── Selection bar ─────────────────────────────────────────────────────── */
  function updateSelbar() {
    var n = state.selected.size;
    var bar = $('selbar');
    bar.classList.toggle('show', n > 0 && !modal);
    $('selcount').innerHTML = '<em>' + n + '</em> selected';
    var domains = new Set();
    state.selected.forEach(function (id) { var s = byId(id); if (s) domains.add(s.domain); });
    var mixed = n > 1 && domains.size > 1;
    $('selwarn').style.display = mixed ? 'inline-flex' : 'none';
    $('selwarn').title = mixed ? 'Runs on all of their target pages — usually you want scripts that target the same site' : '';
    $('combinebtn').disabled = n < 2;
    $('combinebtn').textContent = n < 2 ? '⚡ Select 2+ scripts to combine' : '⚡ Combine ' + n + ' Scripts';
  }

  /* ── Modal: open / close ───────────────────────────────────────────────── */
  function openModal() {
    $('overlay').classList.add('open');
    $('panel').classList.add('open');
    document.body.style.overflow = 'hidden';
    $('panelbody').setAttribute('data-mtab', 'form');
    syncMobileTabs();
  }
  function closeModal() {
    $('overlay').classList.remove('open');
    $('panel').classList.remove('open');
    document.body.style.overflow = '';
    modal = null;
    renderGrid();   // refresh EDITED badges on cards
    updateSelbar();
  }

  function openSingle(id) {
    var s = byId(id);
    if (!s) return;
    if (!sessionValues[id]) sessionValues[id] = {};
    modal = { mode: 'single', id: id, fields: buildFieldsFor(s), values: sessionValues[id] };
    $('m-kicker').textContent = '// configure — your settings, live';
    $('m-title').innerHTML = esc(s.title);
    var p = C.parseHeader(s.code);
    $('m-sub').textContent = 'v' + (s.version || '?') + ' · ' + s.domain + ' · ' +
      (p.meta.match || []).length + ' @match · ' + (s.enabled ? 'active in backup' : 'paused in backup');
    renderModalForm();
    renderCode();
    openModal();
  }

  function openCombined() {
    var ids = Array.from(state.selected);
    if (ids.length < 2) return;
    var groups = ids.map(function (id) {
      var s = byId(id);
      return { script: s, fields: buildFieldsFor(s) };
    });
    var values = {};
    groups.forEach(function (g) {
      var saved = sessionValues[g.script.id] || {};
      g.fields.forEach(function (f) {
        values[g.script.id + '::' + f.key] = { value: saved[f.key] ? saved[f.key].value : f.defValue };
      });
    });
    var name = 'Combined: ' + groups.map(function (g) { return g.script.title; }).join(' + ');
    if (name.length > 90) name = 'Combined ' + groups.length + ' Scripts (' + groups[0].script.domain + ')';
    modal = { mode: 'combined', groups: groups, values: values, name: name };
    $('m-kicker').textContent = '// combine — bundle builder';
    $('m-title').innerHTML = '⚡ <span class="accent">Combined Bundle</span>';
    $('m-sub').textContent = groups.length + ' scripts · ' + Array.from(new Set(groups.map(function (g) { return g.script.domain; }))).join(' + ');
    renderModalForm();
    renderCode();
    openModal();
  }

  /* ── Modal: form rendering ─────────────────────────────────────────────── */
  function fieldHtml(prefix, f) {
    var vk = (prefix || '') + f.key;
    var v = (modal.values[vk] != null && modal.values[vk].value !== undefined) ? modal.values[vk].value : f.defValue;
    var mod = !sameValue(v, f.defValue);
    var ctrl = '';
    var d = 'data-vk="' + esc(vk) + '" data-type="' + f.type + '"';
    if (f.type === 'boolean') {
      ctrl = '<label class="switch"><input type="checkbox" ' + d + (v ? ' checked' : '') + '><span class="slider"></span></label>' +
        '<span style="font-size:12.5px;color:var(--ink-2)">' + (v ? 'On' : 'Off') + '</span>';
    } else if (f.type === 'number') {
      ctrl = '<input type="number" step="any" ' + d + ' value="' + esc(v) + '">';
    } else if (f.type === 'color') {
      var hex = /^#[0-9a-f]{6}$/i.test(v) ? v : (/^#[0-9a-f]{3}$/i.test(v) ? v : '#d93025');
      ctrl = '<input type="color" ' + d + ' value="' + esc(hex) + '">' +
        '<input type="text" class="colortxt" data-vk="' + esc(vk) + '" data-type="colortext" value="' + esc(v) + '">';
    } else if (f.type === 'select') {
      ctrl = '<select ' + d + '>' + (f.options || []).map(function (o) {
        return '<option' + (o === v ? ' selected' : '') + ' value="' + esc(o) + '">' + esc(o) + '</option>';
      }).join('') + '</select>';
    } else if (f.type === 'list') {
      ctrl = '<input type="text" ' + d + ' value="' + esc((Array.isArray(v) ? v : []).join(', ')) + '">' +
        '<div class="hint">Comma-separated list</div>';
    } else if (f.type === 'textarea') {
      ctrl = '<div style="width:100%"><textarea rows="4" ' + d + '>' + esc(v) + '</textarea></div>';
    } else if (f.type === 'json') {
      ctrl = '<div style="width:100%"><textarea rows="8" ' + d + ' spellcheck="false">' + esc(JSON.stringify(v, null, 2)) + '</textarea><div class="jsonerr" style="display:none"></div></div>';
    } else {
      ctrl = '<input type="text" ' + d + ' value="' + esc(v) + '">';
    }
    return '<div class="field" data-frow="' + esc(vk) + '">' +
      '<label>' + (mod ? '<span class="moddot"></span>' : '<span class="moddot" style="visibility:hidden"></span>') +
      esc(f.label) + ' <span class="keyname">' + esc(f.key) + '</span></label>' +
      '<div class="ctrl">' + ctrl +
      (mod ? '<button class="resetfield" data-reset="' + esc(vk) + '" title="Restore default">↺</button>' : '') +
      '</div>' + (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '</div>';
  }

  function renderModalForm() {
    var html = '';
    if (modal.mode === 'single') {
      var s = byId(modal.id);
      var n = scriptChangedCount(s);
      html += n > 0
        ? '<div class="note amber">✏️ <b>' + n + ' customization' + (n > 1 ? 's' : '') + ' applied.</b> Update/download URLs are stripped from customized exports so Tampermonkey can’t auto-update over your changes.</div>'
        : '<div class="note">⚙ Tweak any setting — the code preview on the right updates live. Changes stick to this script and are applied when you copy or download.</div>';
      var curated = modal.fields.filter(function (f) { return !f.auto; });
      var auto = modal.fields.filter(function (f) { return f.auto; });
      if (curated.length) {
        html += '<div class="fgroup"><h4>// settings<span class="rule"></span></h4>' +
          curated.map(function (f) { return fieldHtml('', f); }).join('') + '</div>';
      }
      if (auto.length) {
        html += '<details class="addon"><summary>// auto-detected constants (' + auto.length + ')</summary><div class="inner">' +
          auto.map(function (f) { return fieldHtml('', f); }).join('') + '</div></details>';
      }
      if (!curated.length && !auto.length) {
        html += '<div class="note">This script has no editable constants — use the code pane to copy or download it as-is.</div>';
      }
    } else {
      html += '<div class="note">⚡ <b>Combined bundle.</b> Each script is wrapped in its own IIFE (no variable collisions) and duplicate <code>@match</code>/<code>@grant</code>/<code>@connect</code> directives are merged. Update URLs are removed so the bundle is never auto-replaced.</div>';
      html += '<div class="field"><label>Bundle name <span class="keyname">@name</span></label><div class="ctrl">' +
        '<input type="text" id="bundlename" value="' + esc(modal.name) + '"></div></div>';
      modal.groups.forEach(function (g) {
        var curated = g.fields.filter(function (f) { return !f.auto; });
        var auto = g.fields.filter(function (f) { return f.auto; });
        var dm = domMeta(g.script.domain);
        html += '<div class="bundlehead" style="border-left-color:' + dm.color + '">' + dm.emoji + ' ' + esc(g.script.title) + '</div>';
        if (curated.length) html += curated.map(function (f) { return fieldHtml(g.script.id + '::', f); }).join('');
        if (auto.length) {
          html += '<details class="addon"><summary>// auto-detected (' + auto.length + ')</summary><div class="inner">' +
            auto.map(function (f) { return fieldHtml(g.script.id + '::', f); }).join('') + '</div></details>';
        }
        if (!curated.length && !auto.length) html += '<div class="hint" style="margin:0 0 12px">No editable constants in this script.</div>';
      });
    }
    $('pane-form').innerHTML = html;
    var bn = $('bundlename');
    if (bn) bn.addEventListener('input', function () {
      modal.name = bn.value || 'Combined Bundle';
      scheduleRenderCode();
    });
  }

  /* ── Modal: code preview ───────────────────────────────────────────────── */
  function renderCode() {
    if (!modal) return;
    var ex = currentExport();
    var fname = C.slugify(ex.name) + '.user.js';
    var kb = (ex.code.length / 1024).toFixed(1);
    $('m-fname').textContent = '// ' + fname + ' · ' + kb + ' KB · ' + ex.code.split('\n').length + ' lines · regenerates on every change';
    var badge = $('m-modified');
    if (ex.modified) { badge.textContent = 'CUSTOMIZED'; badge.className = 'modbadge on'; }
    else { badge.textContent = 'UNMODIFIED'; badge.className = 'modbadge off'; }
    var pre = $('m-code');
    if (ex.code.length > 600000) {
      pre.textContent = ex.code;
    } else {
      pre.innerHTML = C.highlight(ex.code);
    }
    pre._fname = fname;
    pre._code = ex.code;
    pre._title = ex.name;
  }
  function scheduleRenderCode() {
    clearTimeout(codeTimer);
    codeTimer = setTimeout(renderCode, 130);
  }

  /* ── Modal: form events ────────────────────────────────────────────────── */
  function findField(vk) {
    if (modal.mode === 'single') {
      for (var i = 0; i < modal.fields.length; i++) if (modal.fields[i].key === vk) return modal.fields[i];
      return null;
    }
    var idx = vk.indexOf('::');
    if (idx === -1) return null;
    var sid = vk.slice(0, idx), key = vk.slice(idx + 2);
    for (var j = 0; j < modal.groups.length; j++) {
      if (modal.groups[j].script.id !== sid) continue;
      var fl = modal.groups[j].fields;
      for (var k = 0; k < fl.length; k++) if (fl[k].key === key) return fl[k];
    }
    return null;
  }

  function parseInput(type, el) {
    if (type === 'boolean') return el.checked;
    if (type === 'number') { var n = parseFloat(el.value); return isNaN(n) ? 0 : n; }
    if (type === 'list') {
      return el.value.split(',').map(function (x) { return x.trim(); }).filter(function (x) { return x !== ''; });
    }
    if (type === 'json') {
      var t = el.value.trim();
      if (t === '') return null;
      try { return JSON.parse(t); } catch (e) {
        var ev = C.evalLiteral(t);
        if (ev.ok) return ev.value;
        return undefined; // signal invalid
      }
    }
    return el.value;
  }

  function onFormInput(e) {
    var el = e.target;
    var vk = el.getAttribute && el.getAttribute('data-vk');
    if (!vk || !modal) return;
    var type = el.getAttribute('data-type');
    var f = findField(vk);
    if (!f) return;

    if (type === 'colortext') {
      // free-text companion of a color picker
      var colorEl = $('pane-form').querySelector('input[type=color][data-vk="' + cssEsc(vk) + '"]');
      if (/^#[0-9a-f]{6}$/i.test(el.value) && colorEl) colorEl.value = el.value;
      modal.values[vk] = { value: el.value };
    } else if (type === 'color') {
      var txtEl = $('pane-form').querySelector('input.colortxt[data-vk="' + cssEsc(vk) + '"]');
      if (txtEl) txtEl.value = el.value;
      modal.values[vk] = { value: el.value };
    } else {
      var v = parseInput(f.type, el);
      if (v === undefined) {
        el.classList.add('invalid');
        var err = el.parentNode && el.parentNode.querySelector('.jsonerr');
        if (err) { err.style.display = 'block'; err.textContent = 'Invalid JSON — check syntax'; }
        return;
      }
      el.classList.remove('invalid');
      var err2 = el.parentNode && el.parentNode.querySelector('.jsonerr');
      if (err2) err2.style.display = 'none';
      modal.values[vk] = { value: v };
    }
    refreshFieldRow(vk, f);
    scheduleRenderCode();
  }

  function refreshFieldRow(vk, f) {
    var row = $('pane-form').querySelector('[data-frow="' + cssEsc(vk) + '"]');
    if (!row) return;
    var v = modal.values[vk] != null ? modal.values[vk].value : f.defValue;
    var mod = !sameValue(v, f.defValue);
    var dot = row.querySelector('.moddot');
    if (dot) dot.style.visibility = mod ? 'visible' : 'hidden';
    var btn = row.querySelector('.resetfield');
    if (mod && !btn) {
      var b = document.createElement('button');
      b.className = 'resetfield'; b.title = 'Restore default';
      b.setAttribute('data-reset', vk); b.textContent = '↺';
      row.querySelector('.ctrl').appendChild(b);
    } else if (!mod && btn) btn.remove();
  }

  $('pane-form').addEventListener('input', onFormInput);
  $('pane-form').addEventListener('change', function (e) {
    if (e.target.getAttribute('data-vk')) onFormInput(e);
  });
  $('pane-form').addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-reset]') : null;
    if (!btn || !modal) return;
    var vk = btn.getAttribute('data-reset');
    var f = findField(vk);
    if (!f) return;
    modal.values[vk] = { value: f.defValue };
    // re-render the whole form to restore control states cleanly
    renderModalForm();
    renderCode();
  });

  /* ── Modal toolbar buttons ─────────────────────────────────────────────── */
  $('m-close').onclick = closeModal;
  $('overlay').onclick = closeModal;
  $('m-copy').onclick = function () {
    var pre = $('m-code');
    copyText(pre._code || '', '✓ Code copied to clipboard — paste into a new Tampermonkey script');
  };
  $('m-download').onclick = function () {
    var pre = $('m-code');
    downloadUserJs(pre._title || 'script', pre._code || '');
  };
  $('m-reset').onclick = function () {
    if (!modal) return;
    if (modal.mode === 'single') {
      sessionValues[modal.id] = {};
      modal.values = sessionValues[modal.id];
    } else {
      modal.groups.forEach(function (g) {
        g.fields.forEach(function (f) {
          modal.values[g.script.id + '::' + f.key] = { value: f.defValue };
        });
      });
    }
    renderModalForm();
    renderCode();
    toast('↺ All customizations restored to defaults');
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal) closeModal();
    if (e.key === '/' && !modal) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault();
        $('search').focus();
      }
    }
  });

  /* ── Mobile tab switcher ───────────────────────────────────────────────── */
  function syncMobileTabs() {
    var cur = $('panelbody').getAttribute('data-mtab') || 'form';
    Array.prototype.forEach.call($('mobiletabs').children, function (b) {
      b.classList.toggle('active', b.getAttribute('data-mtab') === cur);
    });
  }
  Array.prototype.forEach.call($('mobiletabs').children, function (b) {
    b.onclick = function () { $('panelbody').setAttribute('data-mtab', b.getAttribute('data-mtab')); syncMobileTabs(); };
  });

  /* ── Catalog events ────────────────────────────────────────────────────── */
  $('search').addEventListener('input', function () { state.query = this.value; renderGrid(); });
  $('sort').addEventListener('change', function () { state.sort = this.value; renderGrid(); });
  $('tabs').addEventListener('click', function (e) {
    var t = e.target.closest('[data-domain]');
    if (!t) return;
    state.domain = t.getAttribute('data-domain');
    renderTabs();
    renderGrid();
  });
  $('grid').addEventListener('click', function (e) {
    var actEl = e.target.closest('[data-act]');
    var card = e.target.closest('.card');
    if (!card) return;
    var id = card.getAttribute('data-id');
    var act = actEl ? actEl.getAttribute('data-act') : 'open';
    if (act === 'pick') {
      if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
      renderGrid();
    } else if (act === 'customize' || act === 'open') {
      openSingle(id);
    } else if (act === 'copy') {
      var s = byId(id);
      copyText(exportSingleScript(s).code, '✓ “' + s.title + '” copied to clipboard');
    } else if (act === 'download') {
      var s2 = byId(id);
      downloadUserJs(s2.title, exportSingleScript(s2).code);
    }
  });
  $('combinebtn').onclick = openCombined;
  $('clearsel').onclick = function () { state.selected.clear(); renderGrid(); };
  $('selectall').onclick = function () {
    var list = filteredScripts();
    var allSelected = list.every(function (s) { return state.selected.has(s.id); });
    list.forEach(function (s) {
      if (allSelected) state.selected.delete(s.id); else state.selected.add(s.id);
    });
    $('selectall').textContent = allSelected ? '☐ Select all shown' : '☐ ' + list.length + ' selected — click to unselect';
    renderGrid();
  };

  /* ── Boot ──────────────────────────────────────────────────────────────── */
  renderStats();
  renderTabs();
  renderGrid();
})();
