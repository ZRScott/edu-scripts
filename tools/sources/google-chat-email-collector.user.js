// ==UserScript==
// @name         Google Chat Email Collector
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Scrape email addresses from Google Chat messages and copy to clipboard
// @author       Zac
// @match        https://chat.google.com/*
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
  'use strict';

  const PRIMARY = '#722362';
  const PRIMARY_DARK = '#651e56';
  const ACCENT = '#76d5d4';
  const ACCENT_DARK = '#5dc0be';

  const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

  function getStoredEmails() {
    const raw = GM_getValue('gchat_emails', '[]');
    try { return JSON.parse(raw); } catch { return []; }
  }

  function saveEmails(arr) {
    GM_setValue('gchat_emails', JSON.stringify([...new Set(arr)]));
  }

  function scrapeCurrentChat() {
    const messageEls = document.querySelectorAll('[data-message-id], c-wiz [jsname] span, .GDhqjd, .oB7pie');
    const text = Array.from(messageEls).map(el => el.innerText || '').join(' ');
    const found = text.match(EMAIL_REGEX) || [];
    return [...new Set(found.map(e => e.toLowerCase()))];
  }

  function injectUI() {
    if (document.getElementById('gcec-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'gcec-btn';
    btn.title = 'Collect emails from this chat';
    btn.innerText = '📧 Grab Email';
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '80px',
      right: '20px',
      zIndex: 99999,
      background: PRIMARY,
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      padding: '8px 14px',
      fontSize: '13px',
      fontWeight: 'bold',
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      transition: 'background 0.2s',
    });
    btn.onmouseenter = () => btn.style.background = PRIMARY_DARK;
    btn.onmouseleave = () => btn.style.background = PRIMARY;

    const viewBtn = document.createElement('button');
    viewBtn.id = 'gcec-view-btn';
    viewBtn.title = 'View & copy all collected emails';
    viewBtn.innerText = '📋 View All';
    Object.assign(viewBtn.style, {
      position: 'fixed',
      bottom: '40px',
      right: '20px',
      zIndex: 99999,
      background: ACCENT_DARK,
      color: '#fff',
      border: 'none',
      borderRadius: '8px',
      padding: '8px 14px',
      fontSize: '13px',
      fontWeight: 'bold',
      cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      transition: 'background 0.2s',
    });
    viewBtn.onmouseenter = () => viewBtn.style.background = ACCENT;
    viewBtn.onmouseleave = () => viewBtn.style.background = ACCENT_DARK;

    btn.addEventListener('click', () => {
      const found = scrapeCurrentChat();
      if (!found.length) {
        showToast('No emails found in this chat.', '#c0392b');
        return;
      }
      const stored = getStoredEmails();
      const merged = [...new Set([...stored, ...found])];
      saveEmails(merged);
      const newCount = merged.length - stored.length;
      showToast(`Found ${found.length} email(s). ${newCount} new added. Total: ${merged.length}`, PRIMARY);
    });

    viewBtn.addEventListener('click', () => showModal());

    document.body.appendChild(btn);
    document.body.appendChild(viewBtn);
  }

  function showToast(msg, color = PRIMARY) {
    const existing = document.getElementById('gcec-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'gcec-toast';
    toast.innerText = msg;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '130px',
      right: '20px',
      zIndex: 100000,
      background: color,
      color: '#fff',
      padding: '10px 16px',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: 'bold',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      maxWidth: '280px',
      lineHeight: '1.4',
    });
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function showModal() {
    const existing = document.getElementById('gcec-modal');
    if (existing) existing.remove();

    const emails = getStoredEmails();

    const overlay = document.createElement('div');
    overlay.id = 'gcec-modal';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.55)',
      zIndex: 100001,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background: '#1e1e2e',
      borderRadius: '12px',
      padding: '24px',
      width: '420px',
      maxHeight: '70vh',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
      color: '#fff',
      fontFamily: 'sans-serif',
    });

    const title = document.createElement('div');
    title.innerText = `📧 Collected Emails (${emails.length})`;
    Object.assign(title.style, { fontSize: '16px', fontWeight: 'bold', color: ACCENT });

    const textarea = document.createElement('textarea');
    textarea.value = emails.join('\n');
    textarea.readOnly = true;
    Object.assign(textarea.style, {
      width: '100%',
      flex: 1,
      minHeight: '200px',
      background: '#2a2a3e',
      color: '#e0e0e0',
      border: `1px solid ${PRIMARY}`,
      borderRadius: '6px',
      padding: '10px',
      fontSize: '13px',
      resize: 'vertical',
      boxSizing: 'border-box',
    });

    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '10px', justifyContent: 'flex-end' });

    const copyBtn = document.createElement('button');
    copyBtn.innerText = '📋 Copy All';
    styleModalBtn(copyBtn, PRIMARY);
    copyBtn.addEventListener('click', () => {
      GM_setClipboard(emails.join('\n'));
      copyBtn.innerText = '✅ Copied!';
      setTimeout(() => copyBtn.innerText = '📋 Copy All', 2000);
    });

    const clearBtn = document.createElement('button');
    clearBtn.innerText = '🗑 Clear';
    styleModalBtn(clearBtn, '#7f1d1d');
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear all collected emails?')) {
        saveEmails([]);
        overlay.remove();
        showToast('Cleared all emails.', '#7f1d1d');
      }
    });

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕ Close';
    styleModalBtn(closeBtn, '#333');
    closeBtn.addEventListener('click', () => overlay.remove());

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    btnRow.append(clearBtn, copyBtn, closeBtn);
    box.append(title, textarea, btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  function styleModalBtn(btn, bg) {
    Object.assign(btn.style, {
      background: bg,
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      padding: '7px 14px',
      fontSize: '13px',
      fontWeight: 'bold',
      cursor: 'pointer',
    });
  }

  // Init on load and re-check on navigation (GChat is a SPA)
  injectUI();
  const observer = new MutationObserver(() => injectUI());
  observer.observe(document.body, { childList: true, subtree: true });

})();