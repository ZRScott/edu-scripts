/* DOM smoke test: boot the app in jsdom and drive the main flows. */
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/home/user/teacher-script-toolbox.html', 'utf8');
const errors = [];
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'file:///home/user/teacher-script-toolbox.html',
});
const { window } = dom;
const { document } = window;
window.addEventListener('error', e => errors.push('window error: ' + e.message));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  ✗ FAIL:', m); } };

function fire(el, type) { el.dispatchEvent(new window.Event(type, { bubbles: true })); }
function click(el) { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); }
const byDataId = id => document.querySelector('.card[data-id="' + id + '"]');
const tab = name => Array.from(document.querySelectorAll('.tab')).find(t => t.getAttribute('data-domain') === name);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  try {
    await sleep(300);

    /* ── boot ── */
    ok(document.querySelectorAll('.card').length === 29, '29 cards rendered, got ' + document.querySelectorAll('.card').length);
    ok(document.querySelectorAll('.tab').length === 7, '7 tabs, got ' + document.querySelectorAll('.tab').length);
    ok(/\/\/ showing <b>29<\/b> of 29 scripts/i.test(document.getElementById('resultline').innerHTML), 'result line');

    /* ── search ── */
    const search = document.getElementById('search');
    search.value = 'labster';
    fire(search, 'input');
    ok(document.querySelectorAll('.card').length === 2, 'search "labster" → 2, got ' + document.querySelectorAll('.card').length);
    search.value = 'gradebook';
    fire(search, 'input');
    const gbCount = document.querySelectorAll('.card').length;
    ok(gbCount >= 4, 'search "gradebook" → ' + gbCount);
    search.value = '';
    fire(search, 'input');
    ok(document.querySelectorAll('.card').length === 29, 'cleared search → 29');

    /* ── domain tab ── */
    click(tab('Connexus'));
    ok(document.querySelectorAll('.card').length === 16, 'Connexus tab → 16, got ' + document.querySelectorAll('.card').length);
    click(tab('All'));
    ok(document.querySelectorAll('.card').length === 29, 'All tab → 29');

    /* ── sort ── */
    const sort = document.getElementById('sort');
    sort.value = 'az'; fire(sort, 'change');
    const firstTitle = document.querySelector('.card h3').textContent;
    ok(firstTitle === 'Auto Grader', 'A→Z first card is Auto Grader, got ' + firstTitle);
    sort.value = 'default'; fire(sort, 'change');

    /* ── select + combine (two scripts with number fields) ── */
    click(byDataId('log-buttons').querySelector('.pick'));
    click(byDataId('bulk-delete-gb').querySelector('.pick'));
    ok(document.getElementById('selbar').classList.contains('show'), 'selbar visible');
    ok(/2 selected/.test(document.getElementById('selcount').textContent), 'selcount 2');
    ok(!document.getElementById('combinebtn').disabled, 'combine enabled');

    click(document.getElementById('combinebtn'));
    ok(document.getElementById('panel').classList.contains('open'), 'panel opens');
    ok(document.getElementById('m-title').textContent.includes('Combined'), 'combined title');
    const codeText = document.getElementById('m-code').textContent;
    ok(codeText.includes('// ==UserScript=='), 'combined header');
    ok((codeText.match(/\/\/\s*@match/g) || []).length >= 2, '@match lines ≥ 2');
    ok((codeText.match(/@grant GM_setValue/g) || []).length === 1, 'grants deduped');
    ok(codeText.includes('(function () {'), 'IIFE present');
    ok(codeText.includes('✔ Log Buttons') && codeText.includes('✔ Bulk Delete in GB'), 'both banners');
    ok(!/^\s*\/\/\s*@(updateURL|downloadURL)/m.test(codeText), 'no update URLs');
    const fname = document.getElementById('m-fname').textContent;
    ok(fname.includes('.user.js'), 'fname: ' + fname);

    /* edit number field in combined */
    const numInput = document.querySelector('#pane-form input[type=number][data-vk]');
    ok(!!numInput, 'number input in combined form');
    const numVk = numInput.getAttribute('data-vk');
    ok(numVk.includes('log-buttons::'), 'vk namespaced: ' + numVk);
    numInput.value = '4242';
    fire(numInput, 'input');

    /* bundle name */
    const bn = document.getElementById('bundlename');
    ok(!!bn, 'bundle name input');
    bn.value = 'My Super Bundle';
    fire(bn, 'input');
    await sleep(300);

    const code2 = document.getElementById('m-code').textContent;
    ok(/4242/.test(code2), 'number edit applied');
    ok(/@name\s+My Super Bundle/.test(code2), 'bundle name applied');
    ok(document.getElementById('m-modified').textContent === 'CUSTOMIZED', 'combined badge CUSTOMIZED');

    click(document.getElementById('m-close'));

    /* ── single modal: log-buttons ── */
    click(byDataId('log-buttons').querySelector('[data-act=customize]'));
    ok(document.getElementById('panel').classList.contains('open'), 'single modal opens');
    ok(/Log Buttons/.test(document.getElementById('m-title').textContent), 'single title');
    ok(document.getElementById('m-modified').textContent === 'UNMODIFIED', 'starts UNMODIFIED');
    const numFields = document.querySelectorAll('#pane-form input[type=number][data-vk]');
    ok(numFields.length === 4, 'log-buttons has 4 number fields, got ' + numFields.length);
    numFields[0].value = '777';
    fire(numFields[0], 'input');
    await sleep(300);
    ok(/777/.test(document.getElementById('m-code').textContent), 'single edit applied');
    ok(document.getElementById('m-modified').textContent === 'CUSTOMIZED', 'badge CUSTOMIZED');
    click(document.getElementById('m-close'));
    const eb = byDataId('log-buttons').querySelector('.editedbadge');
    ok(!!eb && /EDITED/.test(eb.textContent), 'card shows EDITED badge after close');

    /* ── single modal: highlight-words JSON ── */
    click(byDataId('highlight-words').querySelector('[data-act=customize]'));
    let jsonTa = document.querySelector('#pane-form textarea[data-type=json]');
    ok(!!jsonTa, 'json textarea present');
    const switchEl = document.querySelector('#pane-form input[type=checkbox][data-vk]');
    ok(!!switchEl, 'boolean switch present');
    jsonTa.value = '[{"text":"Nope","color":"red"}]';
    fire(jsonTa, 'input');
    switchEl.checked = false;
    fire(switchEl, 'change');
    await sleep(300);
    const hwCode = document.getElementById('m-code').textContent;
    ok(/Nope/.test(hwCode), 'JSON edit applied');
    ok(/CASE_INSENSITIVE = false/.test(hwCode), 'boolean edit applied');
    /* invalid json → error state, code unchanged */
    jsonTa = document.querySelector('#pane-form textarea[data-type=json]');
    jsonTa.value = '[{broken';
    fire(jsonTa, 'input');
    await sleep(300);
    ok(document.getElementById('m-code').textContent.includes('Nope'), 'invalid JSON keeps last good');
    ok(jsonTa.classList.contains('invalid'), 'invalid class set');
    /* per-field reset */
    const resetBtn = document.querySelector('#pane-form [data-reset]');
    ok(!!resetBtn, 'reset field button appears');
    click(resetBtn);
    await sleep(300);
    const hwCode2 = document.getElementById('m-code').textContent;
    ok(!/Nope/.test(hwCode2) || /Zac/.test(hwCode2), 'field reset restores default');
    click(document.getElementById('m-close'));

    /* ── select-all + mixed warning ── */
    click(document.getElementById('selectall'));
    ok(document.querySelectorAll('.card.selected').length === 29, 'select all → 29');
    ok(document.getElementById('selwarn').style.display !== 'none', 'mixed-domain warning');
    click(document.getElementById('clearsel'));
    ok(document.querySelectorAll('.card.selected').length === 0, 'clear selection');

    /* ── quick copy/download from card (no crash) ── */
    click(byDataId('gv-unread-badge').querySelector('[data-act=copy]'));
    click(byDataId('gv-unread-badge').querySelector('[data-act=download]'));

    /* ── color field check on gc-email-collector ── */
    click(byDataId('gc-email-collector').querySelector('[data-act=customize]'));
    const colorInput = document.querySelector('#pane-form input[type=color][data-vk]');
    const colorTxt = document.querySelector('#pane-form input.colortxt');
    ok(!!colorInput && !!colorTxt, 'color picker + text companion');
    colorInput.value = '#123456';
    fire(colorInput, 'input');
    await sleep(300);
    ok(colorTxt.value === '#123456', 'color text syncs');
    ok(/#123456/.test(document.getElementById('m-code').textContent), 'color applied to code');
    click(document.getElementById('m-close'));

    /* ── escape closes modal ── */
    click(byDataId('auto-grader').querySelector('[data-act=customize]'));
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    ok(!document.getElementById('panel').classList.contains('open'), 'Esc closes modal');

    console.log('\n════════ SMOKE: ' + pass + ' passed, ' + fail + ' failed, pageErrors: ' + JSON.stringify(errors) + ' ════════');
    process.exit(fail || errors.length ? 1 : 0);
  } catch (e) {
    console.log('CRASH:', e.stack);
    process.exit(1);
  }
})();
