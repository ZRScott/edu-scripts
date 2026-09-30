// ==UserScript==
// @name         Google Voice Pinned Tab Unread Badge
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Adds a reliable unread SMS/MMS count badge to pinned Google Voice tabs by updating the favicon and title.
// @author       ChatGPT
// @match        https://voice.google.com/*
// @grant        none
// @run-at       document-idle
// @icon         https://www.svgrepo.com/show/31317/phone-call.svg
// ==/UserScript==

(function () {
    'use strict';

    // ---------- CONFIG ----------
    const CHECK_INTERVAL = 1500;
    const BADGE_BG = '#d93025';
    const BADGE_TEXT = '#ffffff';

    // ---------- STATE ----------
    let lastCount = -1;
    let originalTitle = document.title;
    let originalFavicon = null;

    // ---------- INIT ----------
    function getFavicon() {
        let favicon =
            document.querySelector('link[rel="icon"]') ||
            document.querySelector('link[rel="shortcut icon"]');

        if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
        }

        return favicon;
    }

    function saveOriginalFavicon() {
        const favicon = getFavicon();
        originalFavicon = favicon.href;
    }

    // ---------- UNREAD DETECTION ----------
    function getUnreadCount() {
        const badge = document.querySelector('.mat-badge-content.mat-badge-active');
        if (badge) {
            const num = parseInt(badge.textContent.trim(), 10);
            if (!isNaN(num)) return num;
        }
        return 0;
    }

    // ---------- FAVICON BADGE ----------
    function createBadgedFavicon(count) {
        return new Promise((resolve) => {
            const img = new Image();

            img.crossOrigin = 'anonymous';

            img.onload = function () {
                const size = 64;

                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;

                const ctx = canvas.getContext('2d');

                ctx.drawImage(img, 0, 0, size, size);

                if (count > 0) {
                    const badgeRadius = 26;

                    ctx.fillStyle = BADGE_BG;
                    ctx.beginPath();
                    ctx.arc(size - 20, 20, badgeRadius, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = BADGE_TEXT;
                    ctx.font = 'bold 42px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    const display = count > 99 ? '99+' : count.toString();
                    ctx.fillText(display, size - 20, 20);
                }

                resolve(canvas.toDataURL('image/png'));
            };

            img.onerror = function () {
                resolve(originalFavicon);
            };

            img.src = originalFavicon;
        });
    }

    async function updateBadge() {
        const unreadCount = getUnreadCount();

        if (unreadCount === lastCount) return;

        lastCount = unreadCount;

        document.title = unreadCount > 0
            ? `(${unreadCount}) Google Voice`
            : (originalTitle || 'Google Voice');

        const favicon = getFavicon();

        if (unreadCount > 0) {
            const badgedIcon = await createBadgedFavicon(unreadCount);
            favicon.href = badgedIcon;
        } else {
            favicon.href = originalFavicon;
        }
    }

    // ---------- OBSERVER ----------
    function startObservers() {
        const observer = new MutationObserver(() => {
            updateBadge();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });

        setInterval(updateBadge, CHECK_INTERVAL);

        document.addEventListener('visibilitychange', () => {
            updateBadge();
        });
    }

    // ---------- START ----------
    function init() {
        saveOriginalFavicon();
        updateBadge();
        startObservers();
        console.log('[Google Voice Badge] Running');
    }

    window.addEventListener('load', () => {
        setTimeout(init, 2000);
    });

})();