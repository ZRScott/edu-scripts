// ==UserScript==
// @name         Google Voice Suite
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Remove sidebar, thread tagger, and message tools for Google Voice
// @author       Zac Scott
// @match        https://voice.google.com/u/*
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @icon         https://www.svgrepo.com/show/452085/phone.svg
// @updateURL    https://raw.githubusercontent.com/ZRScott/Byte_Sized/main/Google_Voice_Suite.user.js
// @downloadURL  https://raw.githubusercontent.com/ZRScott/Byte_Sized/main/Google_Voice_Suite.user.js
// ==/UserScript==

(function () {
'use strict';

// ═══════════════════════════════════════════════════════════════════
// VERSION DIALOG
// ═══════════════════════════════════════════════════════════════════

const CURRENT_VERSION = '2.2';
const lastSeenVersion = GM_getValue('lastSeenVersion', null);

if (lastSeenVersion !== CURRENT_VERSION) {
    GM_setValue('lastSeenVersion', CURRENT_VERSION);
    window.addEventListener('load', () => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.5); z-index: 999999; display: flex;
            align-items: center; justify-content: center;
        `;
        const box = document.createElement('div');
        box.style.cssText = `
            background: #722362; color: #76d5d4; font-family: sans-serif;
            padding: 28px 36px; border-radius: 10px; text-align: center;
            border: 2px solid #76d5d4; max-width: 320px;
        `;
        box.innerHTML = `
            <div style="font-size:18px;font-weight:bold;margin-bottom:16px;">Script Updated!</div>
            <div style="font-size:14px;margin-bottom:20px;">Please tell Zac you have been updated to</div>
            <div style="font-size:14px;margin-bottom:20px;">Google Voice Suite version ${CURRENT_VERSION}🎉</div>
            <button id="zac-ok-btn" style="background:#76d5d4;color:#722362;border:none;padding:8px 24px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:14px;">Got it</button>
        `;
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        document.getElementById('zac-ok-btn').onclick = () => overlay.remove();
    });
}

// ═══════════════════════════════════════════════════════════════════
// PART 1 — SIDEBAR MANAGER
// ═══════════════════════════════════════════════════════════════════

function waitForElm(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) return resolve(document.querySelector(selector));
        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) { resolve(document.querySelector(selector)); observer.disconnect(); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

async function initSidebar() {
    const style = document.createElement('style');
    style.textContent = `
        gv-call-sidebar.sidebar-hidden { display: none !important; }
        #gv-sidebar-toggle {
            position: fixed; right: 0; top: 50%; transform: translateY(-50%);
            z-index: 9999; width: 20px; height: 56px; background: #ce93d8;
            border: none; border-radius: 6px 0 0 6px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            box-shadow: -2px 2px 6px rgba(0,0,0,0.3); transition: background 0.15s;
        }
        #gv-sidebar-toggle:hover { background: #9575cd; }
        #gv-sidebar-toggle svg { fill: #000000; transition: transform 0.2s; }
        #gv-sidebar-toggle.open svg { transform: rotate(180deg); }
    `;
    document.head.appendChild(style);

    const toggle = document.createElement('button');
    toggle.id = 'gv-sidebar-toggle';
    toggle.title = 'Toggle call panel';
    toggle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-8 8 8 8 1.41-1.41L8.83 14z"/></svg>`;
    document.body.appendChild(toggle);

    const sidebar = await waitForElm('gv-call-sidebar');
    let manuallyOpen = false;

    const updateVisibility = (isInCall) => {
        if (isInCall) {
            sidebar.classList.remove('sidebar-hidden');
            toggle.classList.add('open');
        } else if (manuallyOpen) {
            sidebar.classList.remove('sidebar-hidden');
            toggle.classList.add('open');
        } else {
            sidebar.classList.add('sidebar-hidden');
            toggle.classList.remove('open');
        }
    };

    const root = await waitForElm('gv-call-sidebar .root');
    new MutationObserver(() => {
        const isInCall = !root.classList.contains('no-active-call');
        if (isInCall) manuallyOpen = false;
        updateVisibility(isInCall);
    }).observe(root, { attributes: true, attributeFilter: ['class'] });

    toggle.addEventListener('click', () => {
        const isInCall = !root.classList.contains('no-active-call');
        if (isInCall) return;
        manuallyOpen = !manuallyOpen;
        updateVisibility(false);
    });

    updateVisibility(!root.classList.contains('no-active-call'));

    window.onkeypress = async function (event) {
        if (event.keyCode === 96) {
            while (document.querySelector("div[aria-label*='Unread']")) {
                const unread = await waitForElm("div[aria-label*='Unread']");
                unread.click();
            }
        }
    };
}

// ═══════════════════════════════════════════════════════════════════
// PART 2 — THREAD TAGGER
// ═══════════════════════════════════════════════════════════════════

function initTagger() {
    const STORAGE_KEY = 'gv_thread_tags';
    const EMOJIS = ['⁉️', '✏️', '📞', '⚠️', '📌'];
    const TAG_BTN_CLASS = 'gv-tagger-btn';
    const TAG_BADGE_CLASS = 'gv-tagger-badge';
    const MENU_CLASS = 'gv-tagger-menu';

    function loadTags() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
    }
    function saveTag(threadId, emoji) {
        const tags = loadTags();
        if (emoji) tags[threadId] = emoji; else delete tags[threadId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
    }
    function getThreadId(listItem) {
        const p = listItem.querySelector('gv-annotation.participants');
        if (!p) return null;
        const text = p.textContent.trim();
        if (!text) return null;
        const sevenDigit = text.match(/\b(\d{7})\b/);
        if (sevenDigit) return 'id_' + sevenDigit[1];
        const phone = text.replace(/\D/g, '');
        if (phone.length >= 10) return 'ph_' + phone;
        return 'nm_' + text.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }

    const s = document.createElement('style');
    s.id = 'gv-tagger-styles';
    s.textContent = `
        li.list-item { position: relative; }
        .${TAG_BTN_CLASS} {
            position: absolute; bottom: 6px; left: 6px; z-index: 10;
            width: 20px; height: 20px; border-radius: 50%; border: none;
            background: #722362; color: #fff; font-size: 11px; line-height: 1;
            cursor: pointer; opacity: 0; transition: opacity 0.15s, background 0.15s;
            padding: 0; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        }
        .${TAG_BTN_CLASS}:hover { background: #651e56; }
        li.list-item:hover .${TAG_BTN_CLASS} { opacity: 1; }
        .${TAG_BADGE_CLASS} {
            position: absolute; top: 4px; left: 0px; z-index: 10; font-size: 20px;
            line-height: 1; pointer-events: none; user-select: none;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35)); transition: opacity 0.15s;
        }
        li.list-item:hover .${TAG_BADGE_CLASS} { opacity: 0.4; }

        /* Per-tag row tints */
        li.list-item[data-gv-tag="⁉️"] .container { background-color: #fff8e1 !important; }
        li.list-item[data-gv-tag="✏️"] .container  { background-color: #e0f7fa !important; }
        li.list-item[data-gv-tag="📞"] .container  { background-color: #e8f5e9 !important; }
        li.list-item[data-gv-tag="⚠️"] .container  { background-color: #fce4ec !important; }
        li.list-item[data-gv-tag="📌"] .container  { background-color: #f3e5f5 !important; }

        .${MENU_CLASS} {
            position: fixed; z-index: 99999; background: #1e1e2e;
            border: 1.5px solid #76d5d4; border-radius: 10px; padding: 6px;
            display: flex; gap: 4px; align-items: center;
            box-shadow: 0 4px 18px rgba(0,0,0,0.5); animation: gv-pop 0.12s ease;
        }
        @keyframes gv-pop { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .${MENU_CLASS} button {
            background: none; border: none; font-size: 18px; cursor: pointer;
            border-radius: 6px; width: 34px; height: 34px; display: flex;
            align-items: center; justify-content: center; transition: background 0.1s;
        }
        .${MENU_CLASS} button:hover { background: #722362; }
        .${MENU_CLASS} .gv-menu-remove {
            font-size: 12px; color: #76d5d4; border-left: 1px solid #444;
            padding: 0 8px; margin-left: 2px; width: auto; white-space: nowrap;
            height: 34px; border-radius: 6px;
        }
        .${MENU_CLASS} .gv-menu-remove:hover { background: #651e56 !important; color: #fff; }
    `;
    document.head.appendChild(s);

    let activeMenu = null;
    function closeMenu() { if (activeMenu) { activeMenu.remove(); activeMenu = null; } }

    function openMenu(btn, listItem, threadId) {
        closeMenu();
        const menu = document.createElement('div');
        menu.className = MENU_CLASS;
        EMOJIS.forEach(emoji => {
            const b = document.createElement('button');
            b.textContent = emoji;
            b.addEventListener('click', (e) => { e.stopPropagation(); saveTag(threadId, emoji); applyBadge(listItem, emoji); closeMenu(); });
            menu.appendChild(b);
        });
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '❌ Remove';
        removeBtn.className = 'gv-menu-remove';
        removeBtn.addEventListener('click', (e) => { e.stopPropagation(); saveTag(threadId, null); applyBadge(listItem, null); closeMenu(); });
        menu.appendChild(removeBtn);
        const rect = btn.getBoundingClientRect();
        menu.style.top = Math.max(4, rect.top - 52) + 'px';
        menu.style.left = Math.max(4, rect.left - 140) + 'px';
        document.body.appendChild(menu);
        activeMenu = menu;
    }

    function applyBadge(listItem, emoji) {
        listItem.querySelector('.' + TAG_BADGE_CLASS)?.remove();
        if (emoji) {
            const badge = document.createElement('span');
            badge.className = TAG_BADGE_CLASS;
            badge.textContent = emoji;
            listItem.appendChild(badge);
            listItem.setAttribute('data-gv-tag', emoji);
        } else {
            listItem.removeAttribute('data-gv-tag');
        }
    }

    function instrumentItem(listItem) {
        const existingId = listItem.dataset.gvTagger;
        const currentId = getThreadId(listItem);
        if (!currentId) return;
        if (existingId && existingId !== currentId) {
            listItem.dataset.gvTagger = '';
            listItem.querySelector('.' + TAG_BTN_CLASS)?.remove();
            listItem.querySelector('.' + TAG_BADGE_CLASS)?.remove();
            listItem.removeAttribute('data-gv-tag');
        }
        if (listItem.dataset.gvTagger === currentId) return;
        listItem.dataset.gvTagger = currentId;
        const btn = document.createElement('button');
        btn.className = TAG_BTN_CLASS;
        btn.textContent = '🏷️';
        btn.title = 'Tag this thread';
        btn.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); openMenu(btn, listItem, currentId); });
        listItem.appendChild(btn);
        const tags = loadTags();
        if (tags[currentId]) applyBadge(listItem, tags[currentId]);
    }

    function processAll() { document.querySelectorAll('li.list-item').forEach(instrumentItem); }
    document.addEventListener('click', (e) => { if (activeMenu && !activeMenu.contains(e.target)) closeMenu(); }, true);
    new MutationObserver(processAll).observe(document.body, { childList: true, subtree: true });
    setTimeout(processAll, 1000);
}

// ═══════════════════════════════════════════════════════════════════
// PART 3 — MESSAGE TOOLS
// ═══════════════════════════════════════════════════════════════════

function initTools() {
    const KEYWORDS = ['absent', 'missing', 'late', 'help', 'sick', 'confused', 'question', 'problem'];
    const COPY_IMG   = `https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExY3E5cmk4bmI3NXE1azRvbjRoY3I3bXNvY3F3bG05YnAyc2h0MGZodCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/iJ2MHQfs5GfkTcJzYR/giphy.gif`;
    const ID_IMG     = `https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExZTY3MTc2b3JlYmxnemc2MHA1MHg0azlsc3B0dGRyNTljZXYyMDhzcSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9dHM/3F76T4vsNcWKd870Zc/giphy.gif`;
    const UNREAD_IMG = `https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExbGdsYTJ3bXpjeGswYjZ4bmpjc29sNXpxdzh6aGc5ZG50emsxc2liYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/xUOwGhauv1d6nceRbi/giphy.gif`;

    let anchorMessage = null;
    let accumulatedIDs = new Set();
    let isAccumulating = false;
    let scrapeThrottleTimer = null;

    // ── Unread filter state ─────────────────────────────────────────
    let unreadFilterActive = false;
    const unreadStyle = document.createElement('style');
    unreadStyle.id = 'gv-unread-filter-style';
    document.head.appendChild(unreadStyle);

    function enableUnreadFilter() {
        unreadStyle.textContent = `
            li.list-item:has(.container.read) {
                visibility: hidden !important;
                pointer-events: none !important;
            }
        `;
    }
    function disableUnreadFilter() {
        unreadStyle.textContent = '';
    }

    function getMyName() {
        const accountBtn = document.querySelector('a[aria-label^="Google Account:"]');
        if (!accountBtn) return 'Me';
        const label = accountBtn.getAttribute('aria-label');
        const match = label.match(/Google Account:\s*([^\n(]+)/);
        if (!match) return 'Me';
        return match[1].trim().split(' ')[0];
    }

    const style = document.createElement('style');
    style.textContent = `
        .gv-unread-highlight { background-color: #ffebee !important; border-left: 4px solid #ef5350 !important; }
        li.list-item { position: relative; }
        .gv-keyword-flag::after {
            content: '🔴'; position: absolute; right: 8px; top: 50%;
            transform: translateY(-50%); font-size: 10px; z-index: 999;
        }
        #gv-acc-btn.accumulating {
            background: rgba(114, 35, 98, 0.15) !important;
            box-shadow: 0 0 0 3px #722362 !important;
        }
        #gv-unread-filter-btn.active {
            background: rgba(118, 213, 212, 0.3) !important;
            box-shadow: 0 0 0 3px #76d5d4 !important;
        }
    `;
    document.head.appendChild(style);

    function highlightUnread() {
        document.querySelectorAll('div[shifthover].container').forEach(row => {
            const isUnread = Array.from(row.querySelectorAll('.cdk-visually-hidden span'))
                .some(span => span.textContent.trim() === 'Unread');
            row.classList.toggle('gv-unread-highlight', isUnread);
        });
    }

    function flagKeywordThreads() {
        document.querySelectorAll('li.list-item').forEach(thread => {
            const preview = thread.querySelector('gv-annotation.preview');
            if (!preview) return;
            thread.classList.toggle('gv-keyword-flag', KEYWORDS.some(kw => preview.textContent.toLowerCase().includes(kw)));
        });
    }

    document.addEventListener('click', (e) => {
        const messageItem = e.target.closest('gv-text-message-item');
        if (messageItem) anchorMessage = messageItem;
    });

    function extractMessageData(item) {
        const hiddenDiv = item.querySelector('.cdk-visually-hidden');
        if (!hiddenDiv) return null;
        const hiddenText = hiddenDiv.textContent;
        const dateMatch = hiddenText.match(/([A-Z][a-z]+)\s+(\d{1,2})\s+(\d{4})/);
        if (!dateMatch) return null;
        const dateObj = new Date(`${dateMatch[1]} ${dateMatch[2]} ${dateMatch[3]}`);
        if (isNaN(dateObj.getTime())) return null;
        dateObj.setHours(0, 0, 0, 0);
        const container = item.querySelector('.full-container');
        let sender = '';
        if (container?.classList.contains('outgoing')) {
            sender = getMyName();
        } else {
            const senderElem = item.querySelector('.sender');
            if (senderElem) sender = senderElem.textContent.trim().split('(ID')[0].trim();
            else { const m = hiddenText.match(/Message from (.*?)(?: \(ID|,)/); if (m) sender = m[1].trim(); }
        }
        const idMatch = hiddenText.match(/\b(\d{7})\b/);
        const content = item.querySelector('gv-annotation.content');
        let cleanText = '';
        if (content) {
            content.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) cleanText += node.textContent;
                else if (node.nodeName === 'IMG') cleanText += node.alt || '';
                else cleanText += node.textContent;
            });
            cleanText = cleanText.trim();
        }
        return { sender, studentId: idMatch ? idMatch[1] : '', text: cleanText, date: dateObj, dateString: dateObj.toDateString() };
    }

    function scrapeVisibleUnreadIDs() {
        document.querySelectorAll('li.list-item .gv-unread-highlight').forEach(thread => {
            const m = thread.querySelector('gv-annotation.participants')?.textContent.match(/\b(\d{7})\b/);
            if (m) accumulatedIDs.add(m[1]);
        });
        updateAccBtnLabel();
    }

    function throttledScrape() {
        if (!isAccumulating || scrapeThrottleTimer) return;
        scrapeThrottleTimer = setTimeout(() => { scrapeThrottleTimer = null; scrapeVisibleUnreadIDs(); }, 250);
    }

    function updateAccBtnLabel() {
        const label = document.getElementById('gv-acc-label');
        if (label) label.innerText = isAccumulating ? `Collecting… (${accumulatedIDs.size})` : 'Collect IDs';
    }

    function toggleAccumulator(btnElement) {
        if (!isAccumulating) {
            accumulatedIDs = new Set();
            isAccumulating = true;
            btnElement.classList.add('accumulating');
            scrapeVisibleUnreadIDs();
            showToast('📜 Scroll through unread messages. IDs are being collected.');
        } else {
            isAccumulating = false;
            if (scrapeThrottleTimer) { clearTimeout(scrapeThrottleTimer); scrapeThrottleTimer = null; }
            btnElement.classList.remove('accumulating');
            const idArray = [...accumulatedIDs];
            if (idArray.length === 0) showFeedback('None found', btnElement);
            else { GM_setClipboard(idArray.join('\n')); showFeedback(`Copied ${idArray.length}!`, btnElement); }
            accumulatedIDs = new Set();
            updateAccBtnLabel();
        }
    }

    function copyMessages(daysToInclude, btnElement) {
        const msgItems = Array.from(document.querySelectorAll('gv-text-message-item'));
        if (!msgItems.length) { showFeedback('No messages', btnElement); return; }
        let parsed = msgItems.map(extractMessageData).filter(m => m && m.text !== '');
        if (!parsed.length) { showFeedback('No text found', btnElement); return; }
        let lastSender = '';
        parsed.forEach(msg => { if (msg.sender) lastSender = msg.sender; else msg.sender = lastSender; });
        const lastDate = parsed[parsed.length - 1].date.getTime();
        const prevDate = new Date(parsed[parsed.length - 1].date);
        prevDate.setDate(prevDate.getDate() - 1);
        const filtered = parsed.filter(msg => {
            const t = msg.date.getTime();
            return daysToInclude === 1 ? t === lastDate : t === lastDate || t === prevDate.getTime();
        });
        if (!filtered.length) { showFeedback('Nothing found', btnElement); return; }
        navigator.clipboard.writeText(filtered.map(m => `${m.sender}: ${m.text}`).join('\n\n'))
            .then(() => showFeedback('Copied!', btnElement));
    }

    function copyFromAnchor(btnElement) {
        const all = Array.from(document.querySelectorAll('gv-text-message-item'));
        if (!all.length) { showFeedback('No messages', btnElement); return; }
        let startIndex = anchorMessage ? all.indexOf(anchorMessage) : -1;
        if (startIndex === -1) startIndex = Math.max(0, all.length - 5);
        let parsed = all.slice(startIndex).map(extractMessageData).filter(m => m && m.text !== '');
        if (!parsed.length) { showFeedback('Nothing found', btnElement); return; }
        let lastSender = '';
        parsed.forEach(msg => { if (msg.sender) lastSender = msg.sender; else msg.sender = lastSender; });
        navigator.clipboard.writeText(parsed.map(m => `${m.sender}: ${m.text}`).join('\n\n'))
            .then(() => { showFeedback(`Copied ${parsed.length}!`, btnElement); anchorMessage = null; });
    }

    function createButtons() {
        if (document.getElementById('gv-copy-container')) return;
        const container = document.createElement('div');
        container.id = 'gv-copy-container';
        container.style.cssText = `position:fixed;left:0;bottom:10%;display:flex;flex-direction:column;gap:20px;align-items:center;z-index:9999;`;

        const btnStyle = `width:48px;height:48px;background:rgba(255,255,255,0.9);border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,0.2);transition:all 0.2s ease;overflow:hidden;`;
        const labelStyle = `margin-top:6px;font-size:12px;color:#5f6368;font-family:Roboto,Arial,sans-serif;font-weight:bold;text-shadow:0 0 2px white;text-align:center;`;

        const hover = (btn) => {
            btn.addEventListener('mouseenter', () => btn.style.transform = 'scale(1.1)');
            btn.addEventListener('mouseleave', () => btn.style.transform = 'scale(1)');
        };

        const makeBtn = (id, tooltip, imgSrc, onClick, labelText) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = `display:flex;flex-direction:column;align-items:center;`;
            const btn = document.createElement('div');
            if (id) btn.id = id;
            btn.title = tooltip;
            btn.style.cssText = btnStyle;
            btn.innerHTML = `<img src="${imgSrc}" style="width:52px;height:52px;object-fit:contain;border-radius:50%;">`;
            btn.onclick = onClick;
            hover(btn);
            const label = document.createElement('span');
            if (id === 'gv-acc-btn') label.id = 'gv-acc-label';
            if (id === 'gv-unread-filter-btn') label.id = 'gv-unread-filter-label';
            label.innerText = labelText;
            label.style.cssText = labelStyle;
            wrap.appendChild(btn);
            wrap.appendChild(label);
            return wrap;
        };

        // Unread Filter button — above Collect IDs
        container.appendChild(makeBtn(
            'gv-unread-filter-btn',
            'Toggle unread-only filter',
            UNREAD_IMG,
            (e) => {
                const btn = document.getElementById('gv-unread-filter-btn');
                const lbl = document.getElementById('gv-unread-filter-label');
                unreadFilterActive = !unreadFilterActive;
                if (unreadFilterActive) {
                    enableUnreadFilter();
                    btn.classList.add('active');
                    if (lbl) lbl.innerText = 'Unread ✓';
                } else {
                    disableUnreadFilter();
                    btn.classList.remove('active');
                    if (lbl) lbl.innerText = 'Unread';
                }
            },
            'Unread'
        ));

        container.appendChild(makeBtn(
            'gv-acc-btn',
            'Click here, scroll messages, click here again. STIDs of unread messages will be copied to clipboard',
            ID_IMG,
            () => toggleAccumulator(document.getElementById('gv-acc-btn')),
            'Collect IDs'
        ));
        container.appendChild(makeBtn(
            null,
            'Copy most recent day',
            COPY_IMG,
            (e) => copyMessages(1, e.currentTarget),
            'Today'
        ));
        container.appendChild(makeBtn(
            null,
            'Click oldest message, then click here.',
            COPY_IMG,
            (e) => copyFromAnchor(e.currentTarget),
            'Custom Range'
        ));

        document.body.appendChild(container);
    }

    function showToast(msg) {
        const t = document.createElement('div');
        t.textContent = msg;
        t.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#323232;color:white;padding:10px 20px;border-radius:6px;font-size:13px;font-family:Roboto,Arial,sans-serif;z-index:100000;opacity:0;transition:opacity 0.3s ease;pointer-events:none;`;
        document.body.appendChild(t);
        requestAnimationFrame(() => t.style.opacity = '1');
        setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2500);
    }

    function showFeedback(message, btn) {
        if (!btn) return;
        const img = btn.querySelector('img');
        if (img) { img.style.transition = 'transform 0.5s ease'; img.style.transform = 'rotate(360deg)'; }
        const text = document.createElement('div');
        text.textContent = message;
        text.style.cssText = `position:fixed;color:#333;background:white;padding:20px;border-radius:4px;box-shadow:0 2px 5px rgba(0,0,0,0.2);font-size:14px;font-family:Roboto,Arial,sans-serif;font-weight:bold;z-index:10000;pointer-events:none;opacity:0;transition:opacity 0.3s ease;`;
        const rect = btn.getBoundingClientRect();
        text.style.left = (rect.right + 10) + 'px';
        text.style.top = (rect.top + 10) + 'px';
        document.body.appendChild(text);
        requestAnimationFrame(() => text.style.opacity = '1');
        setTimeout(() => { if (img) img.style.transform = ''; text.style.opacity = '0'; setTimeout(() => text.remove(), 300); }, 1500);
    }

    highlightUnread();

    new MutationObserver(() => {
        highlightUnread();
        flagKeywordThreads();
        throttledScrape();
        if (!document.getElementById('gv-copy-container') && document.body) createButtons();
    }).observe(document.body, { childList: true, subtree: true });

    setTimeout(() => { flagKeywordThreads(); if (!document.getElementById('gv-copy-container')) createButtons(); }, 1000);
}

// ═══════════════════════════════════════════════════════════════════
// LAUNCH
// ═══════════════════════════════════════════════════════════════════

initSidebar();
initTagger();
initTools();

})();
