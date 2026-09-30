// ==UserScript==
// @name         Highlight Words
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Highlight specific words with colors, make names pulse, and science class link explode.
// @author       Zac Scott
// @match        *://*/*
// @grant        GM_addStyle
// @run-at       document-idle
// @icon         https://www.svgrepo.com/show/400637/rainbow.svg
// ==/UserScript==

(function () {
    'use strict';

    // ────────────────────────────────────────────────────────────────────────────
    // 1. CONFIGURATION: WORDS + COLORS
    // ────────────────────────────────────────────────────────────────────────────
    const HIGHLIGHT_RULES = [
        { text: "Zac", color: "transparent", animation: "pulse" },
        { text: "Zachary", color: "transparent", animation: "pulse" },
        { text: "Physical Science S1 A", color: "transparent", animation: "explosion" },
        { text: "Physical Science S1 B", color: "transparent", animation: "explosion" },
        { text: "Physical Science S2 A", color: "transparent", animation: "explosion" },
        { text: "Physical Science S2 B", color: "transparent", animation: "explosion" },
        { text: "Physical Science B", color: "transparent", animation: "explosion" },
        { text: "Physical Science A", color: "transparent", animation: "explosion" },
        { text: "Physical Science", color: "transparent", animation: "explosion" },
        { text: "Contacts (Alarm)", color: "red", textColor: "white" },
        { text: "Phone call - successful", color: "lightgreen" },
        { text: "Text Message", color: "lightblue" },
        { text: "Welcome Call", color: "silver" },
        { text: "Verified Visible Check", color: "lightgreen" },
    ];

    const CASE_INSENSITIVE = true;

    // ────────────────────────────────────────────────────────────────────────────
    // 2. CSS STYLING
    // ────────────────────────────────────────────────────────────────────────────
    GM_addStyle(`
    @keyframes name-pulse-animation {
        0% { transform: scale(1); color: #2ed573; }
        50% { transform: scale(1.15); color: #ff4757; text-shadow: 0 0 8px rgba(255, 71, 87, 0.5); }
        100% { transform: scale(1); color: #2ed573; }
    }

    @keyframes science-explosion-animation {
        0% {
            transform: scale(0.9) rotate(0deg);
            color: #ffcc00;
            text-shadow: 0 0 0 rgba(255, 100, 0, 0);
        }
        20% {
            transform: scale(1) rotate(-3deg);
            color: #ff4500;
            text-shadow: 0 0 6px #ff6600, 0 0 12px #ffcc00;
        }
        40% {
            transform: scale(1.05) rotate(3deg);
            color: #ffffff;
            text-shadow: 0 0 10px #ff3300, 0 0 20px #ffaa00, 0 0 30px #fff200;
        }
        60% {
            transform: scale(1) rotate(-2deg);
            color: #ff4500;
            text-shadow: 0 0 8px #ff6600, 0 0 16px #ffcc00;
        }
        100% {
            transform: scale(0.9) rotate(0deg);
            color: #ffcc00;
            text-shadow: 0 0 0 rgba(255, 100, 0, 0);
        }
    }
    `);

    function makeClassName(text) {
        return "hl-" + text.replace(/[^\w]/g, "-").toLowerCase();
    }

    HIGHLIGHT_RULES.forEach(rule => {
        const cls = makeClassName(rule.text);
        rule.className = cls;

        if (rule.animation === "pulse") {
            GM_addStyle(`
            .${cls} {
                display: inline-block !important;
                vertical-align: top !important;
                line-height: inherit !important;
                margin: 0 !important;
                font-weight: 900 !important;
                animation: name-pulse-animation 1.5s infinite ease-in-out;
                padding: 0 2px;
                background: transparent !important;
            }
            `);
        } else if (rule.animation === "explosion") {
            GM_addStyle(`
            .${cls} {
                display: inline-block !important;
                vertical-align: top !important;
                line-height: inherit !important;
                margin: 0 !important;
                font-weight: 900 !important;
                animation: science-explosion-animation 2.2s infinite ease-in-out;
                padding: 0 2px;
                background: transparent !important;
            }
            `);
        } else {
            GM_addStyle(`
            .${cls} {
                background-color: ${rule.color} !important;
                color: ${rule.textColor || "black"} !important;
                font-weight: bold;
                padding: 1px 2px;
                border-radius: 2px;
            }
            `);
        }
    });

    // ────────────────────────────────────────────────────────────────────────────
    // 3. REGEX ENGINE
    // ────────────────────────────────────────────────────────────────────────────
    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function buildRegex() {
        const parts = HIGHLIGHT_RULES.map(rule => {
            const t = rule.text.trim();
            const escaped = escapeRegExp(t);
            const startsWithWord = /^\w/.test(t);
            const endsWithWord = /\w$/.test(t);
            return (
                (startsWithWord ? "\\b" : "") +
                escaped +
                (endsWithWord ? "\\b" : "")
            );
        });
        return new RegExp("(" + parts.join("|") + ")", CASE_INSENSITIVE ? "gi" : "g");
    }

    const REGEX = buildRegex();

    function getRuleForMatchedText(text) {
        return HIGHLIGHT_RULES.find(rule =>
            text.toLowerCase() === rule.text.toLowerCase()
        );
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 4. HIGHLIGHTING LOGIC
    // ────────────────────────────────────────────────────────────────────────────
    function highlightWordsInNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const parent = node.parentNode;
            if (!parent || ["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(parent.tagName)) return;
            if (parent.isContentEditable) return;
            if (parent.closest('[class^="hl-"]')) return;

            const text = node.nodeValue;
            let match;
            const fragment = document.createDocumentFragment();
            let lastIndex = 0;
            let found = false;

            REGEX.lastIndex = 0;

            while ((match = REGEX.exec(text)) !== null) {
                found = true;

                const before = text.substring(lastIndex, match.index);
                if (before) fragment.appendChild(document.createTextNode(before));

                const matchedText = match[0];
                const rule = getRuleForMatchedText(matchedText);
                const span = document.createElement("span");
                span.className = rule.className;
                span.textContent = matchedText;
                fragment.appendChild(span);

                lastIndex = REGEX.lastIndex;
            }

            if (found) {
                const after = text.substring(lastIndex);
                if (after) fragment.appendChild(document.createTextNode(after));
                node.parentNode.replaceChild(fragment, node);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === "SPAN" && node.className.startsWith("hl-")) return;
            Array.from(node.childNodes).forEach(child => highlightWordsInNode(child));
        }
    }

    function runHighlight() {
        highlightWordsInNode(document.body);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // 5. OBSERVER
    // ────────────────────────────────────────────────────────────────────────────
    runHighlight();

    let debounceTimer;
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(runHighlight, 150);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();