// ==UserScript==
// @name         Google Chat Font Size Adjuster
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Make all chat messages in the reading pane larger and uniform font size
// @author       Zac Scott
// @match        https://*.google.com/*
// @grant        GM_addStyle
// @icon         https://www.svgrepo.com/show/439162/font-size.svg
// ==/UserScript==

(function() {
    'use strict';

    // Apply font size to all message text containers
    GM_addStyle(`
        /* Main message text */
        .DTp27d.QIJiHb.Zc1Emd,
        /* Extra variations if Google changes the wrapper */
        .DTp27d,
        .QIJiHb,
        .Zc1Emd {
            font-size: 16px !important;
            line-height: 1.4 !important;
        }
    `);

    // Mutation observer to catch dynamically loaded messages
    const target = document.body;
    const observer = new MutationObserver(() => {
        document.querySelectorAll('.DTp27d.QIJiHb.Zc1Emd, .DTp27d, .QIJiHb, .Zc1Emd').forEach(el => {
            el.style.fontSize = "20px";
            el.style.lineHeight = "1.6";
        });
    });

    observer.observe(target, { childList: true, subtree: true });
})();
