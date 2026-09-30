// ==UserScript==
// @name         Log Buttons
// @namespace    https://www.connexus.com/
// @version      4.7
// @description  Adds buttons to the Logt
// @match        https://www.connexus.com/log*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const DATAVIEW_ID = 789;
    const EOY_DATAVIEW_ID = 3626;
    const SUT_DATAVIEW_ID = 22;
    const SAVE_TIMEOUT = 3000;

    const style = document.createElement('style');
    style.innerHTML = `
        .cxIcon.customClearAlarmIcon {
            background-image: url("https://www.svgrepo.com/show/286772/refresh.svg") !important;
            background-repeat: no-repeat;
            background-position: center;
            background-size: contain;
            padding-left: 18px;
        }
        .saving-active {
            opacity: 0.5;
            cursor: wait !important;
            pointer-events: none;
        }
        #tmToolbarEoy a, #tmToolbarSut a {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 36px !important;
            height: 36px !important;
            padding: 0 !important;
            text-decoration: none !important;
        }
        .tmEoyLabel, .tmSutLabel {
            font-size: 11px;
            font-weight: bold;
            color: #722362;
            line-height: 1.1;
            text-align: center;
            text-decoration: none !important;
        }
        #tmToolbarEoy a:hover .tmEoyLabel, #tmToolbarSut a:hover .tmSutLabel {
            color: #651e56;
        }
    `;
    document.head.appendChild(style);

    function getStudentId() {
        return new URLSearchParams(window.location.search).get('idWebuser');
    }

    function setBusy(linkElement, isBusy, text) {
        const span = linkElement.querySelector('span');
        if (isBusy) {
            linkElement.classList.add('saving-active');
            if (span) span.innerText = text || "Saving...";
        } else {
            linkElement.classList.remove('saving-active');
            if (span) span.innerText = "Save";
        }
    }

    function cleanupOldFrames() {
        document.querySelectorAll('#tmSaveFrame').forEach(f => f.remove());
    }

    function triggerRealSave(idWebuser, linkElement) {
        cleanupOldFrames();

        const frame = document.createElement('iframe');
        frame.id = 'tmSaveFrame';
        Object.assign(frame.style, {
            position: 'fixed',
            left: '-9999px',
            top: '0',
            width: '1px',
            height: '1px',
            opacity: '0'
        });

        let timeoutId;

        frame.onload = () => {
            try {
                const w = frame.contentWindow;
                const d = frame.contentDocument;

                if (!d) throw new Error('No iframe document access');

                if (w.dataview?.setAllowRedirects) {
                    w.dataview.setAllowRedirects(false);
                }

                const realBtn = d.querySelector('#save');
                if (!realBtn) throw new Error('Save button not found');

                realBtn.click();

                timeoutId = setTimeout(() => {
                    setBusy(linkElement, false);
                    cleanupOldFrames();
                }, SAVE_TIMEOUT);

            } catch (err) {
                clearTimeout(timeoutId);
                setBusy(linkElement, false);
                console.error('Save error:', err);
                alert(`Save failed: ${err.message}`);
                cleanupOldFrames();
            }
        };

        frame.onerror = () => {
            clearTimeout(timeoutId);
            setBusy(linkElement, false);
            alert('Failed to load save page');
            cleanupOldFrames();
        };

        const url = `https://www.connexus.com/dataview/${DATAVIEW_ID}?idWebuser=${encodeURIComponent(idWebuser)}`;
        frame.src = url;
        document.body.appendChild(frame);
    }

    function injectToolbarButton() {
        if (document.getElementById('tmToolbarSave')) return;

        const idWebuser = getStudentId();
        if (!idWebuser) return;

        const toolbar = document.querySelector('ul.new-info-toolbar');
        if (!toolbar) return;

        // --- Save Button (original) ---
        const li = document.createElement('li');
        li.id = 'tmToolbarSave';

        const a = document.createElement('a');
        a.href = "#";
        a.title = "Refresh Contacts (Alarm), use after logging Phone call - successful";

        const span = document.createElement('span');
        span.className = "cxIcon customClearAlarmIcon";
        span.innerText = "Save";

        a.appendChild(span);
        li.appendChild(a);
        toolbar.appendChild(li);

        a.addEventListener('click', (e) => {
            e.preventDefault();
            if (a.classList.contains('saving-active')) return;
            setBusy(a, true, "Saving...");
            triggerRealSave(idWebuser, a);
        });

        // --- EOY/ITR Button ---
        if (!document.getElementById('tmToolbarEoy')) {
            const eoyLi = document.createElement('li');
            eoyLi.id = 'tmToolbarEoy';

            const eoyA = document.createElement('a');
            eoyA.href = `https://www.connexus.com/dataview/${EOY_DATAVIEW_ID}?idWebuser=${encodeURIComponent(idWebuser)}`;
            eoyA.target = '_blank';
            eoyA.title = "EOY / ITR Tasks";
            eoyA.className = "docs-creator";

            const eoySpan = document.createElement('span');
            eoySpan.className = "tmEoyLabel";
            eoySpan.innerText = "EOY";

            eoyA.appendChild(eoySpan);
            eoyLi.appendChild(eoyA);
            toolbar.appendChild(eoyLi);
        }

        // --- SUT Button ---
        if (!document.getElementById('tmToolbarSut')) {
            const sutLi = document.createElement('li');
            sutLi.id = 'tmToolbarSut';

            const sutA = document.createElement('a');
            sutA.href = `https://www.connexus.com/dataview/${SUT_DATAVIEW_ID}?idWebuser=${encodeURIComponent(idWebuser)}`;
            sutA.target = '_blank';
            sutA.title = "SUT";
            sutA.className = "docs-creator";

            const sutSpan = document.createElement('span');
            sutSpan.className = "tmSutLabel";
            sutSpan.innerText = "SUT";

            sutA.appendChild(sutSpan);
            sutLi.appendChild(sutA);
            toolbar.appendChild(sutLi);
        }
    }

    injectToolbarButton();

    if (!document.querySelector('ul.new-info-toolbar')) {
        const observer = new MutationObserver(() => {
            if (document.querySelector('ul.new-info-toolbar')) {
                injectToolbarButton();
                observer.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();