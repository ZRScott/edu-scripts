// ==UserScript==
// @name         Webmail Inbox - Full Height
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Attempts to make the Connexus webmail table fill available vertical space.
// @author       Glenn Rusher
// @match        https://www.connexus.com/webmail*
// @grant        GM_addStyle
// @icon         https://www.svgrepo.com/show/407674/up-down-arrow.svg
// ==/UserScript==

(function() {
    'use strict';

    const mailViewerSelector = 'div#webMailViewer';
    const scrollPaneSelector = 'div#webMailViewer > div.messagesScrollPane.ng-scope'; // Direct child
    const webMailTableSelector = 'div.webMailTable'; // The element with the inline height

    // Selectors for the intermediate containers between scrollPane and webMailTable
    const intermediateContainerSelectors = [
        `${scrollPaneSelector} > div[data-ui-view].ng-scope`,
        `${scrollPaneSelector} > div[data-ui-view].ng-scope > div.ng-scope[data-ng-hide]`, // for the data-ng-hide div
        `${scrollPaneSelector} > div[data-ui-view].ng-scope > div.ng-scope[data-ng-hide] > div#webMailMessageGrid_wrapper`,
        `${scrollPaneSelector} > div[data-ui-view].ng-scope > div.ng-scope[data-ng-hide] > div#webMailMessageGrid_wrapper > div.webMailGrid`
    ];

    function applyFullHeightStyles() {
        const mailViewer = document.querySelector(mailViewerSelector);
        const scrollPane = document.querySelector(scrollPaneSelector);
        const webMailTable = document.querySelector(webMailTableSelector);

        if (mailViewer && scrollPane && webMailTable) {
            console.log("Tampermonkey: Found all key elements:", { mailViewer, scrollPane, webMailTable });

            let styles = `
                /* 1. Ensure the main mail viewer container can utilize height and is a flex container */
                ${mailViewerSelector} {
                    height: 100% !important; /* Crucial: Assumes parent of #webMailViewer allows this */
                    display: flex !important;
                    flex-direction: column !important;
                    min-height: 0; /* Prevent content from forcing it larger than 100% */
                }

                /* 2. Make the scrollPane a flex item that grows and also a flex container */
                ${scrollPaneSelector} {
                    flex-grow: 1 !important;
                    display: flex !important;
                    flex-direction: column !important;
                    min-height: 0 !important; /* Essential for flex children to shrink/grow properly */
                    overflow: hidden; /* Often good for scroll containers that manage their own scroll child */
                }
            `;

            // 3. Make all intermediate containers also flex containers that allow growth
            intermediateContainerSelectors.forEach(selector => {
                styles += `
                    ${selector} {
                        display: flex !important;
                        flex-direction: column !important;
                        flex-grow: 1 !important;
                        min-height: 0 !important;
                        /* height: 100%; */ /* Let flex-grow manage height primarily */
                    }
                `;
            });

            // 4. Make the webMailTable the final flex child that grows and scrolls
            styles += `
                ${webMailTableSelector} {
                    flex-grow: 1 !important;
                    height: auto !important; /* OVERRIDES INLINE STYLE */
                    min-height: 100px !important; /* A sensible minimum, adjust as needed */
                    overflow-y: auto !important; /* Ensure the table itself can scroll */
                }
            `;

            GM_addStyle(styles);
            console.log("Tampermonkey: Applied styles v0.6.");

        } else {
            console.log("Tampermonkey: Could not find one or more required elements.");
            if (!mailViewer) console.log(" - mailViewer not found:", mailViewerSelector);
            if (!scrollPane) console.log(" - scrollPane not found:", scrollPaneSelector);
            if (!webMailTable) console.log(" - webMailTable not found:", webMailTableSelector);
            // Check intermediate elements too
            intermediateContainerSelectors.forEach(selector => {
                if (!document.querySelector(selector)) {
                    console.log(` - intermediate container not found: ${selector}`);
                }
            });
        }
    }

    // Use MutationObserver to wait for elements to appear
    const observer = new MutationObserver((mutationsList, observerInstance) => {
        // Check if all necessary elements are present
        const mailViewer = document.querySelector(mailViewerSelector);
        const scrollPane = document.querySelector(scrollPaneSelector);
        const webMailTable = document.querySelector(webMailTableSelector);
        let allIntermediatesFound = true;
        intermediateContainerSelectors.forEach(selector => {
            if (!document.querySelector(selector)) {
                allIntermediatesFound = false;
            }
        });

        if (mailViewer && scrollPane && webMailTable && allIntermediatesFound) {
            applyFullHeightStyles();
            observerInstance.disconnect(); // Stop observing once done
            console.log("Tampermonkey: All elements found, applied styles, and disconnected observer.");
        }
    });

    // Start observing the document for changes
    // Observing documentElement is usually sufficient and more performant than body for subtree changes
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Fallback for elements already present on script injection (e.g. after soft refresh)
    if (document.readyState === "interactive" || document.readyState === "complete") {
        // Check if elements are already there before starting observer, to avoid race condition
        const mailViewer = document.querySelector(mailViewerSelector);
        const scrollPane = document.querySelector(scrollPaneSelector);
        const webMailTable = document.querySelector(webMailTableSelector);
        let allIntermediatesFound = true;
        intermediateContainerSelectors.forEach(selector => {
            if (!document.querySelector(selector)) {
                allIntermediatesFound = false;
            }
        });
        if (mailViewer && scrollPane && webMailTable && allIntermediatesFound) {
            applyFullHeightStyles();
            observer.disconnect(); // Disconnect if already applied
             console.log("Tampermonkey: Elements found on readyState, applied styles, and disconnected observer.");
        }
    }
})();