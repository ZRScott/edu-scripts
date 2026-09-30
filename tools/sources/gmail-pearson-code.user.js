// ==UserScript==
// @name         Gmail Pearson Code
// @namespace    zac.tools
// @version      3.0
// @description  Extract newest Pearson verification code from inbox
// @match        https://mail.google.com/*
// @grant        GM_setClipboard
// @run-at       document-idle
// @icon         https://www.svgrepo.com/show/172005/password.svg
// ==/UserScript==

(function() {
    'use strict';

    let lastCode = null;

    function scanInbox() {

        const rows = document.querySelectorAll('tr.zA'); // inbox rows

        for (let row of rows) {

            const preview = row.querySelector('span.y2');
            if (!preview) continue;

            const text = preview.innerText;

            if (!text.includes("Pearson Verification Code Requested")) continue;

            const match = text.match(/Verification code is:\s*(\d{6})/i);

            if (match) {
                const code = match[1];

                if (code !== lastCode) {
                    lastCode = code;
                    GM_setClipboard(code);
                    console.log("Newest Verification Code copied:", code);
                }

                break; // stop after first (newest) match
            }
        }
    }

    const observer = new MutationObserver(() => {
        scanInbox();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
