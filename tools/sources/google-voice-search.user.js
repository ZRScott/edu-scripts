// ==UserScript==
// @name         Google Voice > Search
// @namespace    http://tampermonkey.net/
// @version      4.1
// @description  Adds a search (magnifying glass) icon next to phone numbers, opens/ reuses GV and triggers search
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @icon         https://www.svgrepo.com/show/474980/search.svg
// ==/UserScript==

(function () {
    'use strict';

    const phoneRegex = /(\+?1[\s\-\.]?)?\(?\d{3}\)?[\s\-\.]?\d{3}[\s\-\.]?\d{4}/g;
    const processedAttr = 'data-gv-processed';

    // On Google Voice page - auto-search
    if (window.location.hostname === 'voice.google.com') {
        const searchNum = GM_getValue('gv_search_number');
        if (searchNum) {
            GM_setValue('gv_search_number', '');

            function pressEnter(target) {
                const event = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    view: window
                });
                target.dispatchEvent(event);

                const eventUp = new KeyboardEvent('keyup', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true,
                    composed: true,
                    view: window
                });
                target.dispatchEvent(eventUp);
            }

            function attemptSearch() {
                const searchBtn = document.querySelector('[aria-label="Search"]') ||
                                 document.querySelector('button[jsname][aria-label*="Search"]');

                if (searchBtn) {
                    searchBtn.click();

                    setTimeout(() => {
                        const input = document.querySelector('input[aria-label="Search"]') ||
                                    document.querySelector('input[type="text"][placeholder*="Search"]');

                        if (input) {
                            input.focus();
                            input.value = searchNum;

                            // Trigger all input events
                            ['input', 'change', 'keyup'].forEach(eventType => {
                                input.dispatchEvent(new Event(eventType, { bubbles: true }));
                            });

                            // Try finding and clicking any search/submit buttons
                            setTimeout(() => {
                                // Look for search icon button or submit
                                const buttons = Array.from(document.querySelectorAll('button'));
                                const searchSubmit = buttons.find(btn =>
                                    btn.getAttribute('aria-label')?.includes('Search') ||
                                    btn.type === 'submit' ||
                                    btn.querySelector('[aria-label*="Search"]')
                                );

                                if (searchSubmit) {
                                    searchSubmit.click();
                                } else {
                                    pressEnter(input);
                                }

                                // Last resort: try form submit
                                setTimeout(() => {
                                    const form = input.closest('form');
                                    if (form) {
                                        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
                                    }

                                    // Press Enter on body/document to navigate results
                                    setTimeout(() => {
                                        const activeEl = document.activeElement || document.body;
                                        activeEl.focus();
                                        pressEnter(activeEl);
                                    }, 2000);

                                    setTimeout(() => {
                                        const activeEl = document.activeElement || document.body;
                                        activeEl.focus();
                                        pressEnter(activeEl);
                                    }, 2500);
                                }, 200);
                            }, 500);
                        }
                    }, 700);
                } else {
                    setTimeout(attemptSearch, 500);
                }
            }

            setTimeout(attemptSearch, 1500);
        }
        return;
    }

    // On other pages - add click icons
    function createVoiceLink(phoneText) {
        const link = document.createElement('a');

        // Use an inline SVG magnifying glass icon for crisp rendering
        link.innerHTML = `
            <svg role="img" aria-hidden="false" focusable="false" width="14" height="14" viewBox="0 0 24 24" style="vertical-align:middle;">
                <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path>
            </svg>
        `;
        // Styling and accessibility
        link.style.cssText = 'margin-left:3px;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;';
        link.setAttribute('role', 'button');
        link.setAttribute('aria-label', 'Search this number in Google Voice');
        link.title = 'Search this number in Google Voice';

        link.onclick = e => {
            e.preventDefault();
            e.stopPropagation();
            const digits = phoneText.replace(/\D/g, '').slice(-10);
            if (digits.length === 10) {
                GM_setValue('gv_search_number', digits);

                const url = 'https://voice.google.com/u/0/messages';
                try {
                    let gvWin = window.open('', 'google_voice_window');

                    if (gvWin && !gvWin.closed) {
                        try {
                            gvWin.location.href = url;
                        } catch (err) {}
                        try { gvWin.focus(); } catch (err) {}
                    } else {
                        gvWin = window.open(url, 'google_voice_window');
                        try { gvWin.focus(); } catch (err) {}
                    }
                } catch (err) {
                    try { window.open(url, 'google_voice_window'); } catch (e) { window.open(url, '_blank'); }
                }
            }
        };
        return link;
    }

    function isEditable(el) {
        while (el && el !== document.body) {
            if (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                return true;
            }
            el = el.parentElement;
        }
        return false;
    }

    function processTextNode(node) {
        const parent = node.parentNode;
        if (!parent || parent.hasAttribute(processedAttr) || isEditable(parent)) return;

        // Skip if GV already injected a gv-tel-link after this text node
        const siblings = Array.from(parent.childNodes);
        const nodeIndex = siblings.indexOf(node);
        if (siblings.some((s, i) => i > nodeIndex && s.nodeType === Node.ELEMENT_NODE && s.classList?.contains('gv-tel-link'))) return;

        const text = node.textContent;
        const matches = [...text.matchAll(phoneRegex)];
        if (matches.length === 0) return;

        const wrapper = document.createElement('span');
        wrapper.setAttribute(processedAttr, 'true');

        let lastIndex = 0;
        matches.forEach(match => {
            let matchIndex = match.index;
            let matchText = match[0];
            // If preceded by '(', include it in the match so the full number stays in one span
            if (matchIndex > 0 && text[matchIndex - 1] === '(') {
                matchIndex -= 1;
                matchText = '(' + matchText;
            }
            wrapper.appendChild(document.createTextNode(text.slice(lastIndex, matchIndex)));
            const numSpan = document.createElement('span');
            numSpan.textContent = matchText;
            wrapper.appendChild(numSpan);
            wrapper.appendChild(createVoiceLink(matchText));
            lastIndex = matchIndex + matchText.length;
        });
        wrapper.appendChild(document.createTextNode(text.slice(lastIndex)));

        parent.replaceChild(wrapper, node);
    }

    function scan(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            processTextNode(node);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.hasAttribute(processedAttr)) return;
            const style = window.getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden') return;
            Array.from(node.childNodes).forEach(scan);
        }
    }

    // Delay initial scan to allow Google Voice extension to inject its icons first
    setTimeout(() => scan(document.body), 2500);

    let debounceTimer;
    new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => scan(document.body), 100);
    }).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });
})();