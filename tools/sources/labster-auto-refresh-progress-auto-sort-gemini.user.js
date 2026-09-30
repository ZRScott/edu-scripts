// ==UserScript==
// @name         Labster Auto-Refresh & Progress Auto-Sort - Gemini
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Auto-refreshes Labster portal and keeps student roster sorted by progress.
// @match        https://*.labster.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ================= CONFIGURATION =================
    const REFRESH_INTERVAL_SECONDS = 30; // Time in seconds between reloads
    const SORT_DIRECTION = 'descending'; // 'descending' (highest % first) or 'ascending' (lowest % first)
    // =================================================

    let countdown = REFRESH_INTERVAL_SECONDS;
    let isPaused = false;
    let hasSorted = false;

    // 1. Create floating status widget
    function createUI() {
        if (document.getElementById('labster-auto-refresh-badge')) return;

        const badge = document.createElement('div');
        badge.id = 'labster-auto-refresh-badge';
        badge.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 999999;
            background: #1976D2;
            color: #ffffff;
            padding: 8px 14px;
            border-radius: 20px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            display: flex;
            align-items: center;
            gap: 10px;
            user-select: none;
        `;

        badge.innerHTML = `
            <span id="labster-timer-text">Auto-refreshing in ${countdown}s</span>
            <button id="labster-toggle-btn" style="
                background: #ffffff;
                color: #1976D2;
                border: none;
                padding: 3px 10px;
                border-radius: 12px;
                cursor: pointer;
                font-size: 12px;
                font-weight: bold;
            ">Pause</button>
        `;

        document.body.appendChild(badge);

        const toggleBtn = document.getElementById('labster-toggle-btn');
        toggleBtn.addEventListener('click', () => {
            isPaused = !isPaused;
            if (isPaused) {
                toggleBtn.textContent = 'Resume';
                badge.style.background = '#616161';
                document.getElementById('labster-timer-text').textContent = 'Auto-refresh paused';
            } else {
                toggleBtn.textContent = 'Pause';
                badge.style.background = '#1976D2';
                countdown = REFRESH_INTERVAL_SECONDS;
            }
        });
    }

    // 2. Locate and click the 'Progress' header
    function autoSortTable() {
        if (hasSorted) return;

        const headers = Array.from(document.querySelectorAll('th.sortable, th'));
        const progressHeader = headers.find(th => th.textContent.trim().startsWith('Progress'));

        if (!progressHeader) return;

        const currentSort = progressHeader.getAttribute('aria-sort') || 'none';

        if (currentSort === SORT_DIRECTION) {
            hasSorted = true;
            return;
        }

        // Trigger click on Progress column
        progressHeader.click();

        // Check if a second click is needed (e.g. none -> ascending -> descending)
        setTimeout(() => {
            const updatedSort = progressHeader.getAttribute('aria-sort');
            if (updatedSort !== SORT_DIRECTION && updatedSort !== 'none') {
                progressHeader.click();
            }
            hasSorted = true;
        }, 300);
    }

    // 3. Watch DOM for table loading (handles dynamic asynchronous page loads)
    function observePage() {
        const observer = new MutationObserver(() => {
            createUI();
            autoSortTable();
        });

        observer.observe(document.body, { childList: true, subtree: true });
        createUI();
        autoSortTable();
    }

    // 4. Timer loop for auto-refresh
    function startTimer() {
        setInterval(() => {
            if (isPaused) return;

            countdown--;
            const timerText = document.getElementById('labster-timer-text');
            if (timerText) {
                timerText.textContent = `Auto-refreshing in ${countdown}s`;
            }

            if (countdown <= 0) {
                location.reload();
            }
        }, 1000);
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            observePage();
            startTimer();
        });
    } else {
        observePage();
        startTimer();
    }
})();