// ==UserScript==
// @name         Labster Grades Auto-Refresh + Sort by Progress - Claud
// @namespace    local.labster.autorefresh
// @version      1.0
// @description  Reloads the Labster grades page on an interval and re-sorts by Progress (highest first).
// @match        https://*.labster.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const REFRESH_SECONDS = 30;          // change refresh interval here
  const KEY = 'labsterAutoRefreshOn';  // remembers on/off across reloads

  const isOn = () => localStorage.getItem(KEY) !== 'off';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function waitFor(selector, timeout = 20000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const t = setInterval(() => {
        const el = document.querySelector(selector);
        if (el || Date.now() - start > timeout) {
          clearInterval(t);
          resolve(el);
        }
      }, 250);
    });
  }

  function progressValues() {
    return [...document.querySelectorAll('tr.info-row [data-testid="progressInPercents"] [data-testid="score"]')]
      .map((s) => parseFloat(s.textContent) || 0);
  }

  function isDescending() {
    const v = progressValues();
    for (let i = 1; i < v.length; i++) if (v[i] > v[i - 1]) return false;
    return v.length > 1 && v[0] > v[v.length - 1];
  }

  function progressHeader() {
    return [...document.querySelectorAll('.grades-table th')]
      .find((th) => th.textContent.trim().startsWith('Progress'));
  }

  async function sortByProgress() {
    if (!(await waitFor('.grades-table tbody tr.info-row'))) return;
    await sleep(800); // let rows finish rendering
    const th = progressHeader();
    if (!th) return;
    for (let i = 0; i < 3 && !isDescending(); i++) {
      th.click();
      await sleep(400);
    }
  }

  function addToggle() {
    const btn = document.createElement('button');
    btn.style.cssText =
      'position:fixed;top:200px;right:16px;z-index:99999;padding:8px 12px;' +
      'border:none;border-radius:6px;color:#fff;font:13px sans-serif;cursor:pointer;opacity:.9;';
    const render = (remaining) => {
      btn.style.background = isOn() ? '#2e7d32' : '#757575';
      btn.textContent = isOn() ? `Auto-refresh ON (${remaining}s)` : 'Auto-refresh OFF';
    };
    btn.onclick = () => {
      localStorage.setItem(KEY, isOn() ? 'off' : 'on');
      remaining = REFRESH_SECONDS;
      render(remaining);
    };
    document.body.appendChild(btn);

    let remaining = REFRESH_SECONDS;
    render(remaining);
    setInterval(() => {
      if (!document.querySelector('.grades-page')) return;
      if (!isOn()) return render(remaining);
      remaining--;
      if (remaining <= 0) location.reload();
      else render(remaining);
    }, 1000);
  }

  (async function init() {
    if (!(await waitFor('.grades-page'))) return;
    addToggle();
    if (isOn()) sortByProgress();
  })();
})();