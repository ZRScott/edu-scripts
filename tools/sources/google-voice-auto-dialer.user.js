// ==UserScript==
// @name         Google Voice Auto Dialer
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Auto dialer for voice.google.com — persists list, logs outcomes + contact names
// @author       You
// @match        https://voice.google.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
  'use strict';

  // ── State ───────────────────────────────────────────────────────────────────
  let numbers   = GM_getValue('gvd_numbers', []);
  let current   = GM_getValue('gvd_current', 0);
  let contacts  = GM_getValue('gvd_contacts', {});
  let autoNext  = GM_getValue('gvd_autonext', false);
  let autoDelay = GM_getValue('gvd_delay', 30);
  let log       = GM_getValue('gvd_log', []);

  let countdownTimer = null;
  let urlPoller      = null;

  const DISPOSITIONS = ['Answered', 'No Answer', 'Voicemail', 'Busy', 'Wrong Number', 'Callback'];

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function btnStyle(bg, color) {
    return `background:${bg};color:${color};border:none;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:12px`;
  }
  function tabStyle(active) {
    return `background:${active?'#1a73e8':'#eee'};color:${active?'#fff':'#333'};border:none;padding:4px 8px;border-radius:6px;cursor:pointer;font-size:11px`;
  }
  function formatNumber(raw) {
    const d = raw.replace(/\D/g,'');
    if (d.length === 10) return '+1' + d;
    if (d.length === 11 && d[0] === '1') return '+' + d;
    return null;
  }
  function setStatus(msg, color='#555') {
    const el = document.getElementById('gvd-status');
    if (el) { el.textContent = msg; el.style.color = color; }
  }
  function persist() {
    GM_setValue('gvd_numbers', numbers);
    GM_setValue('gvd_current', current);
  }
  function updateProgress() {
    const el = document.getElementById('gvd-progress');
    if (!el || !numbers.length) { if(el) el.textContent=''; return; }
    const num = numbers[current];
    const c   = contacts[num];
    el.innerHTML = `${current+1} / ${numbers.length}<br>${c ? `<span style="color:#34a853">${c.name}${c.id ? ` — ID ${c.id}` : ''}</span><br>` : ''}${num}`;
    document.getElementById('gvd-input').value = numbers.join('\n');
  }

  // ── Panel ───────────────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position:'fixed', top:'80px', right:'16px', zIndex:'99999',
    background:'#fff', border:'1px solid #ccc', borderRadius:'10px',
    boxShadow:'0 4px 16px rgba(0,0,0,0.18)', padding:'14px',
    width:'270px', fontFamily:'sans-serif', fontSize:'13px'
  });
  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <b style="font-size:14px">📞 Auto Dialer</b>
      <div style="display:flex;gap:4px">
        <button id="gvd-logtab"  style="${tabStyle(false)}">Log</button>
        <button id="gvd-maintab" style="${tabStyle(true)}">Dialer</button>
        <button id="gvd-toggle"  style="${btnStyle('#eee','#333')}">−</button>
      </div>
    </div>
    <div id="gvd-body">
      <div id="gvd-dialer">
        <textarea id="gvd-input" placeholder="Paste numbers, one per line&#10;10-digit or +1 format"
          style="width:100%;height:80px;box-sizing:border-box;font-size:12px;padding:6px;
                 border:1px solid #ccc;border-radius:6px;resize:vertical"></textarea>
        <button id="gvd-load" style="${btnStyle('#1a73e8','#fff')};width:100%;margin:6px 0">Load Numbers</button>
        <div id="gvd-status"   style="text-align:center;color:#555;margin-bottom:4px;min-height:16px"></div>
        <div id="gvd-progress" style="text-align:center;font-weight:bold;color:#1a73e8;margin-bottom:8px;font-size:12px;line-height:1.4"></div>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button id="gvd-prev" style="${btnStyle('#f1f3f4','#333')};flex:1">◀</button>
          <button id="gvd-dial" style="${btnStyle('#34a853','#fff')};flex:2">📞 Dial</button>
          <button id="gvd-next" style="${btnStyle('#f1f3f4','#333')};flex:1">▶</button>
        </div>
        <div style="margin-bottom:6px">
          <div style="margin-bottom:4px;color:#444;font-weight:bold">Outcome:</div>
          <div id="gvd-disps" style="display:flex;flex-wrap:wrap;gap:4px"></div>
        </div>
        <textarea id="gvd-note" placeholder="Notes for this call…"
          style="width:100%;height:52px;box-sizing:border-box;font-size:12px;padding:6px;
                 border:1px solid #ccc;border-radius:6px;resize:vertical;margin-bottom:6px"></textarea>
        <button id="gvd-save" style="${btnStyle('#fbbc04','#333')};width:100%;margin-bottom:8px">💾 Save & Next</button>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <input type="checkbox" id="gvd-auto" ${autoNext?'checked':''}>
          <label for="gvd-auto">Auto-next after</label>
          <input id="gvd-delay" type="number" value="${autoDelay}" min="5" max="300"
            style="width:46px;padding:2px 4px;border:1px solid #ccc;border-radius:4px">
          <span>sec</span>
        </div>
        <div id="gvd-countdown" style="text-align:center;color:#e67700;font-size:12px;min-height:14px"></div>
        <button id="gvd-clear" style="${btnStyle('#fce8e6','#c5221f')};width:100%;margin-top:8px">🗑 Clear List</button>
      </div>
      <div id="gvd-log" style="display:none">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span id="gvd-log-count" style="font-weight:bold;color:#444">${log.length} calls logged</span>
          <div style="display:flex;gap:4px">
            <button id="gvd-export"   style="${btnStyle('#1a73e8','#fff')}">Export CSV</button>
            <button id="gvd-clearlog" style="${btnStyle('#fce8e6','#c5221f')}">Clear</button>
          </div>
        </div>
        <div id="gvd-log-entries" style="max-height:300px;overflow-y:auto;font-size:11px"></div>
      </div>
    </div>`;
  document.body.appendChild(panel);

  // ── Disposition buttons ──────────────────────────────────────────────────────
  let selectedDisp = '';
  const dispContainer = document.getElementById('gvd-disps');
  DISPOSITIONS.forEach(d => {
    const b = document.createElement('button');
    b.textContent = d; b.dataset.disp = d;
    b.style.cssText = `${btnStyle('#f1f3f4','#333')};font-size:11px`;
    b.addEventListener('click', () => {
      selectedDisp = d;
      dispContainer.querySelectorAll('button').forEach(x => {
        x.style.background = x.dataset.disp===d ? '#1a73e8' : '#f1f3f4';
        x.style.color      = x.dataset.disp===d ? '#fff'    : '#333';
      });
    });
    dispContainer.appendChild(b);
  });

  // ── Contact name scraping ────────────────────────────────────────────────────
  function scrapeContactName() {
    const el = document.querySelector('.remote-display-title');
    if (!el) return null;
    const text = el.textContent.trim();
    if (!text) return null;
    const match = text.match(/^(.*?)\s*\(ID\s*(\d+)\)\s*$/i);
    if (match) return { name: match[1].trim(), id: match[2] };
    return { name: text, id: '' };
  }
  function watchForContactName(number) {
    if (contacts[number]) return;
    let attempts = 0;
    const iv = setInterval(() => {
      const c = scrapeContactName();
      if (c) {
        contacts[number] = c;
        GM_setValue('gvd_contacts', contacts);
        const noteEl = document.getElementById('gvd-note');
        if (noteEl) noteEl.placeholder = `Notes for ${c.name}…`;
        updateProgress();
        clearInterval(iv);
      }
      if (++attempts > 20) clearInterval(iv);
    }, 500);
  }

  // ── Log ──────────────────────────────────────────────────────────────────────
  function dispColor(d) {
    return {Answered:'#34a853','No Answer':'#ea4335',Voicemail:'#fbbc04',
            Busy:'#ea4335','Wrong Number':'#9e9e9e',Callback:'#1a73e8'}[d]||'#555';
  }
  function renderLog() {
    log = GM_getValue('gvd_log', []);
    document.getElementById('gvd-log-count').textContent = `${log.length} calls logged`;
    const c = document.getElementById('gvd-log-entries');
    if (!log.length) { c.innerHTML='<div style="color:#aaa;text-align:center;padding:10px">No calls logged yet.</div>'; return; }
    c.innerHTML = [...log].reverse().map(e=>`
      <div style="border-bottom:1px solid #eee;padding:5px 2px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            ${e.name?`<b style="color:#1a73e8">${e.name}</b>${e.id?` <span style="color:#888;font-size:10px">ID ${e.id}</span>`:''}<br>`:''}
            <span style="color:#555">${e.number}</span>
          </div>
          <span style="color:${dispColor(e.disposition)};font-size:10px;text-align:right">${e.disposition||'—'}</span>
        </div>
        <div style="color:#888;font-size:10px">${e.time}</div>
        ${e.note?`<div style="color:#444;margin-top:2px">${e.note}</div>`:''}
      </div>`).join('');
  }
  function saveEntry(number) {
    const note = document.getElementById('gvd-note').value.trim();
    const c    = contacts[number] || {};
    log = GM_getValue('gvd_log', []);
    log.push({ number, name:c.name||'', id:c.id||'', disposition:selectedDisp, note, time:new Date().toLocaleString() });
    GM_setValue('gvd_log', log);
    document.getElementById('gvd-note').value = '';
    selectedDisp = '';
    dispContainer.querySelectorAll('button').forEach(x=>{ x.style.background='#f1f3f4'; x.style.color='#333'; });
    const noteEl = document.getElementById('gvd-note');
    if (noteEl) noteEl.placeholder = 'Notes for this call…';
  }

  // ── Countdown ────────────────────────────────────────────────────────────────
  function clearCountdown() {
    clearInterval(countdownTimer); countdownTimer = null;
    const cd = document.getElementById('gvd-countdown');
    if (cd) cd.textContent = '';
  }
  function startCountdown() {
    clearCountdown();
    let secs = autoDelay;
    const cd = document.getElementById('gvd-countdown');
    countdownTimer = setInterval(() => {
      if (cd) cd.textContent = `Auto-next in ${secs}s`;
      secs--;
      if (secs < 0) { clearCountdown(); goNext(true); }
    }, 1000);
  }

  // ── Call-end poller — watches for .remote-display-title to disappear ─────────
  // During a call the element exists. When the call ends it's removed from DOM.
  function startUrlPoller() {
    stopUrlPoller();
    // Wait until the element appears first (call connected), then watch for it to leave
    let callStarted = false;
    urlPoller = setInterval(() => {
      const el = document.querySelector('.remote-display-title');
      if (!callStarted && el) {
        callStarted = true; // call is now active
      }
      if (callStarted && !el) {
        // Element gone — call has ended
        stopUrlPoller();
        if (autoNext) startCountdown();
      }
    }, 500);
  }
  function stopUrlPoller() {
    clearInterval(urlPoller); urlPoller = null;
  }

  // ── Dial ─────────────────────────────────────────────────────────────────────
  function dial(num) {
    const fmt = formatNumber(num);
    if (!fmt) { setStatus('Invalid: ' + num, '#c5221f'); return; }
    persist();
    window.location.href = `https://voice.google.com/u/0/calls?a=nc,${encodeURIComponent(fmt)}`;
    setTimeout(startUrlPoller, 2000);
  }

  function goNext(autoSave=false) {
    if (!numbers.length) return;
    if (autoSave) saveEntry(numbers[current]);
    if (current < numbers.length - 1) {
      current++; persist(); updateProgress(); dial(numbers[current]);
    } else {
      setStatus('✅ All numbers dialed!', '#34a853');
      document.getElementById('gvd-progress').textContent = '';
    }
  }

  // ── Events ────────────────────────────────────────────────────────────────────
  document.getElementById('gvd-load').addEventListener('click', () => {
    const lines = document.getElementById('gvd-input').value.trim().split('\n').map(l=>l.trim()).filter(Boolean);
    const valid = lines.filter(l=>formatNumber(l));
    if (!valid.length) { setStatus('No valid numbers found.', '#c5221f'); return; }
    numbers=valid; current=0; persist(); updateProgress();
    setStatus(`Loaded ${valid.length} numbers.`, '#34a853');
  });

  document.getElementById('gvd-dial').addEventListener('click', () => {
    if (!numbers.length) { setStatus('Load numbers first.', '#c5221f'); return; }
    clearCountdown(); stopUrlPoller(); dial(numbers[current]);
  });

  document.getElementById('gvd-save').addEventListener('click', () => {
    if (!numbers.length) return;
    saveEntry(numbers[current]); clearCountdown(); stopUrlPoller(); goNext(false);
  });

  document.getElementById('gvd-next').addEventListener('click', () => {
    clearCountdown(); stopUrlPoller(); goNext(false);
  });

  document.getElementById('gvd-prev').addEventListener('click', () => {
    if (!numbers.length || current===0) return;
    clearCountdown(); stopUrlPoller(); current--; persist(); updateProgress(); setStatus('');
  });

  document.getElementById('gvd-auto').addEventListener('change', e => {
    autoNext = e.target.checked;
    GM_setValue('gvd_autonext', autoNext);
    if (!autoNext) { clearCountdown(); stopUrlPoller(); }
  });

  document.getElementById('gvd-delay').addEventListener('change', e => {
    autoDelay = parseInt(e.target.value,10) || 30;
    GM_setValue('gvd_delay', autoDelay);
  });

  document.getElementById('gvd-clear').addEventListener('click', () => {
    numbers=[]; current=0;
    GM_setValue('gvd_numbers',[]); GM_setValue('gvd_current',0);
    clearCountdown(); stopUrlPoller();
    document.getElementById('gvd-input').value='';
    document.getElementById('gvd-progress').textContent='';
    setStatus('List cleared.');
  });

  document.getElementById('gvd-clearlog').addEventListener('click', () => {
    GM_setValue('gvd_log',[]); log=[]; renderLog();
  });

  document.getElementById('gvd-export').addEventListener('click', () => {
    log = GM_getValue('gvd_log',[]);
    if (!log.length) return;
    const csv = 'Name,ID,Number,Disposition,Notes,Time\n' +
      log.map(e=>`"${e.name||''}","${e.id||''}","${e.number}","${e.disposition||''}","${(e.note||'').replace(/"/g,'""')}","${e.time}"`).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'gvoice_calls_' + Date.now() + '.csv';
    a.click();
  });

  document.getElementById('gvd-maintab').addEventListener('click', () => {
    document.getElementById('gvd-dialer').style.display='block';
    document.getElementById('gvd-log').style.display='none';
    document.getElementById('gvd-maintab').style.cssText=tabStyle(true);
    document.getElementById('gvd-logtab').style.cssText=tabStyle(false);
  });

  document.getElementById('gvd-logtab').addEventListener('click', () => {
    document.getElementById('gvd-dialer').style.display='none';
    document.getElementById('gvd-log').style.display='block';
    document.getElementById('gvd-logtab').style.cssText=tabStyle(true);
    document.getElementById('gvd-maintab').style.cssText=tabStyle(false);
    renderLog();
  });

  document.getElementById('gvd-toggle').addEventListener('click', () => {
    const body = document.getElementById('gvd-body');
    const tbtn = document.getElementById('gvd-toggle');
    const hidden = body.style.display==='none';
    body.style.display = hidden?'block':'none';
    tbtn.textContent   = hidden?'−':'+';
  });

  // ── Init ─────────────────────────────────────────────────────────────────────
  if (numbers.length) {
    updateProgress();
    setStatus(`Resumed — ${numbers.length} numbers loaded.`, '#1a73e8');
    setTimeout(() => watchForContactName(numbers[current]), 2000);
    // Start poller — will wait for call to connect then end
    if (autoNext) startUrlPoller();
  }

})();