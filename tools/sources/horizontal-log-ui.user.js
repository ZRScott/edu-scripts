// ==UserScript==
// @name         Horizontal Log UI
// @namespace    http://tampermonkey.net/
// @version      12.0
// @description  Sets specific widths (400/200/300) and hides headers on the 2nd and 3rd boxes.
// @author       Zac Scott
// @match        https://www.connexus.com/log*
// @match        https://www.connexus.com/log/*
// @grant        GM_addStyle
// @icon         https://www.svgrepo.com/show/406049/left-right-arrow.svg
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    //      ⚙️ CONFIGURATION
    // ==========================================

    const panelsConfig = [
        {
            id: "contactPreferences_portalletMain", // Box 1
            width: "400px",
            hideHeader: false // Keep the header on the first one
        },
        {
            id: "studentAdditionalInfo_portalletMain", // Box 2
            width: "200px",
            hideHeader: true  // REMOVE yellow strip
        },
        {
            id: "contactInformation_portalletMain", // Box 3
            width: "300px",
            hideHeader: true  // REMOVE yellow strip
        }
    ];

    // ==========================================

    const toolbarSelector = "ul.new-info-toolbar";
    const myContainerID = "custom-user-layout-container";

    function applyCustomLayout() {
        const toolbar = document.querySelector(toolbarSelector);
        if (!toolbar) return;

        // Check if all panels exist
        const allPanelsExist = panelsConfig.every(config => document.getElementById(config.id));
        if (!allPanelsExist) return;

        let rowContainer = document.getElementById(myContainerID);

        // 1. Create the Container
        if (!rowContainer) {
            rowContainer = document.createElement('div');
            rowContainer.id = myContainerID;

            rowContainer.style.cssText = `
                display: flex !important;
                flex-direction: row !important;
                width: 100% !important;
                max-width: 100% !important;
                gap: 15px !important;
                justify-content: flex-start !important;
                align-items: flex-start !important;
                box-sizing: border-box !important;
                margin-top: 15px;
                margin-bottom: 20px;
            `;

            // Force parent column to expand
            if(toolbar.parentNode) {
                let parentColumn = toolbar.parentNode;
                if (parentColumn.tagName === 'SPAN') parentColumn = parentColumn.parentNode;

                if (parentColumn) {
                    parentColumn.style.width = "100%";
                    parentColumn.style.maxWidth = "none";

                    const insertTarget = toolbar.closest('span.new-info-toolbar-parent') || toolbar;
                    insertTarget.parentNode.insertBefore(rowContainer, insertTarget.nextSibling);
                }
            }
        }

        // 2. Loop through our Config to apply specific settings
        panelsConfig.forEach(config => {
            const panel = document.getElementById(config.id);

            if (panel && panel.parentNode !== rowContainer) {

                // --- APPLY SPECIFIC WIDTHS ---
                // flex: 0 0 [WIDTH] -> Do not grow, Do not shrink, Stay exactly at [WIDTH]
                panel.style.cssText = `
                    flex: 0 0 ${config.width} !important;
                    width: ${config.width} !important;
                    min-width: ${config.width} !important;
                    max-width: ${config.width} !important;
                    margin-bottom: 0px !important;
                    box-sizing: border-box !important;
                    background-color: #fff8dc;
                    overflow: hidden; /* Keeps content inside the fixed width */
                `;

                // --- HIDE HEADER (Yellow Strip) ---
                const header = panel.querySelector('.portalletHeader');
                if(header) {
                    if(config.hideHeader) {
                        // Completely removes the yellow strip and title
                        header.style.display = "none";
                        // Adds a tiny top border so the box doesn't look invisible at the top
                        panel.style.borderTop = "1px solid #d4c484";
                    } else {
                        // Just fix the text wrapping for the one we kept
                        header.style.whiteSpace = "nowrap";
                        header.style.width = "100%";
                    }
                }

                // --- FIX BODY TEXT ---
                // Forces text to wrap so it doesn't spill out of the 200px box
                const body = panel.querySelector('.portalletBody');
                if(body) {
                   body.style.width = "100%";
                   body.style.whiteSpace = "normal";
                   body.style.wordWrap = "break-word";
                   body.style.overflowWrap = "break-word";
                }

                rowContainer.appendChild(panel);
            }
        });
    }

    setInterval(applyCustomLayout, 1000);

})();