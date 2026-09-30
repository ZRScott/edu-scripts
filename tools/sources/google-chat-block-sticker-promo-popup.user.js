// ==UserScript==
// @name         Google Chat - Block Sticker Promo Popup
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Blocks the "New look, more fun!" sticker promo popup in Google Chat
// @match        https://chat.google.com/*
// @match        https://mail.google.com/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    const css = `
        /* Hide the outer dialog wrapper containing the sticker promo */
        div.zlUWSb:has(img[src*="stickers_education_promo.gif"]),
        /* Backup target for the internal callout container */
        div.eVDL2-WsjYwc[data-is-multi-line-mini-callout="true"]:has(img[src*="stickers_education_promo.gif"]) {
            display: none !important;
            visibility: hidden !important;
            pointer-events: none !important;
        }
    `;

    if (typeof GM_addStyle !== 'undefined') {
        GM_addStyle(css);
    } else {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }
})();