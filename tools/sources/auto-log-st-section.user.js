// ==UserScript==
// @name         Auto Log ST & Section
// @namespace    https://example.com/
// @version      0.4.0
// @description  Automatically selects section and student based on page title after dynamic load.
// @match        https://www.connexus.com/log/logEntry*
// @run-at       document-idle
// @icon         https://www.svgrepo.com/show/520503/quiz.svg
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ===========================
    // CONFIGURATION BLOCK
    // Adjust values if elements or desired selections change on the portal
    // ===========================
    const CONFIG = {
        selectors: {
            // Element containing the student's name and ID in the page title
            pageTitleStudentInfo: '#pageTitleHeaderTextSpan',

            // SECTION MENU:
            sectionToggleIcon: '#section_ToggleIcon_img',
            // List of possible section names — the script will select whichever one is present.
            sectionLinkTextOptions: [
                'Mr. Scott\'s 11th Grade Homeroom',
                'Physical Science S1 A',
                'Physical Science S1 B',
                'Physical Science S2 A',
                'Physical Science S2 B',
            ],
            sectionLinksContainerSelector: '#section_Picker',

            // STUDENT MENU:
            studentToggleIcon: '#contactees_ToggleIcon_img',
            studentLinkBaseId: 'Link_',
            studentLinksContainerSelector: '#contactees_Picker',
        },

        // Delays for robust interaction
        menuOpenDelayMs: 1000,
        postSelectionClickDelayMs: 200,
        elementPresenceTimeoutMs: 15000,
        toastDisplayTimeMs: 3000,

        // Automation trigger settings ZAC CHANGED FROM 7000 TO 4000 Feb 10
        initialAutomationDelayMs: 4000,

        // Flags to prevent re-running automation multiple times
        automationTriggered: false,
    };
    // ===========================
    // END CONFIGURATION
    // ===========================


    // Utility function for delays
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // Helper to click an opener and wait for menu to potentially appear
    async function clickOpener(selector) {
        const el = document.querySelector(selector);
        if (!el) {
            throw new Error(`Opener element not found: ${selector}`);
        }
        el.click();
        await sleep(CONFIG.menuOpenDelayMs);
        return el;
    }

    // Robust function to wait for an element then click it
    async function waitForElementAndClick(parentSelector, targetIdentifier, isIdBased = false) {
        const startTime = Date.now();
        let targetLink = null;
        let finalSelectorUsed = '';

        while (!targetLink && (Date.now() - startTime < CONFIG.elementPresenceTimeoutMs)) {
            const parentEl = document.querySelector(parentSelector);
            if (!parentEl) {
                console.warn(`[${GM.info.script.name}] Parent element not found yet: ${parentSelector}. Retrying...`);
                await sleep(100);
                continue;
            }

            if (isIdBased) {
                finalSelectorUsed = `#${targetIdentifier}`;
                targetLink = parentEl.querySelector(finalSelectorUsed);
            } else {
                // Look for links within the picker (available items), not already chosen items
                const links = parentEl.querySelectorAll('a.pickListInlineLink');
                targetLink = Array.from(links).find(link => {
                    const text = link.textContent.trim();
                    const isMatch = text.includes(targetIdentifier.trim());
                    const isVisible = link.offsetParent !== null || window.getComputedStyle(link).display !== 'none';
                    return isMatch && isVisible;
                });
                finalSelectorUsed = `a.pickListInlineLink:contains("${targetIdentifier}") in ${parentSelector}`;
            }

            if (targetLink) {
                const style = window.getComputedStyle(targetLink);

                // Check if clickable
                const isInteractable = (
                    style.display !== 'none' &&
                    style.visibility !== 'hidden'
                );

                if (isInteractable) {
                    console.log(`[${GM.info.script.name}] Found and clicking: ${finalSelectorUsed}`);
                    targetLink.click();
                    await sleep(CONFIG.postSelectionClickDelayMs);
                    return true;
                } else {
                    console.warn(`[${GM.info.script.name}] Found element but not visible yet. Display: ${style.display}, Visibility: ${style.visibility}`);
                }
            }
            await sleep(100);
        }

        throw new Error(`Timeout: Could not find or click element: ${finalSelectorUsed || `(Parent: ${parentSelector}, Identifier: "${targetIdentifier}")`}`);
    }

    // Tries multiple possible section names, in order, and clicks whichever one is found first.
    // Only waits the full timeout on the LAST option; earlier options get a quick check so we
    // don't stall for 15s per wrong guess.
    async function waitForAnyElementAndClick(parentSelector, identifierOptions) {
        const quickCheckMs = 800;
        let lastError = null;

        for (let i = 0; i < identifierOptions.length; i++) {
            const identifier = identifierOptions[i];
            const isLastOption = i === identifierOptions.length - 1;
            const startTime = Date.now();
            const timeout = isLastOption ? CONFIG.elementPresenceTimeoutMs : quickCheckMs;

            while (Date.now() - startTime < timeout) {
                const parentEl = document.querySelector(parentSelector);
                if (parentEl) {
                    const links = parentEl.querySelectorAll('a.pickListInlineLink');
                    const targetLink = Array.from(links).find(link => {
                        const text = link.textContent.trim();
                        const isMatch = text.includes(identifier.trim());
                        const isVisible = link.offsetParent !== null || window.getComputedStyle(link).display !== 'none';
                        return isMatch && isVisible;
                    });

                    if (targetLink) {
                        const style = window.getComputedStyle(targetLink);
                        if (style.display !== 'none' && style.visibility !== 'hidden') {
                            console.log(`[${GM.info.script.name}] Found and clicking section: "${identifier}"`);
                            targetLink.click();
                            await sleep(CONFIG.postSelectionClickDelayMs);
                            return identifier;
                        }
                    }
                }
                await sleep(100);
            }
            lastError = `"${identifier}" not found`;
            console.log(`[${GM.info.script.name}] Section option not found, trying next: ${lastError}`);
        }

        throw new Error(`Timeout: Could not find any of the configured sections. Last: ${lastError}`);
    }


    // Main automation logic
    async function runAutomation() {
        if (CONFIG.automationTriggered) {
            console.log(`[${GM.info.script.name}] Automation already triggered, skipping.`);
            return;
        }
        CONFIG.automationTriggered = true; // Set flag to prevent re-running

        console.log(`[${GM.info.script.name}] Starting automatic automation...`);
        let studentName = '';
        let studentID = '';

        try {
            // 1. Extract Student Name and ID from the Page Title
            const pageTitleSpan = document.querySelector(CONFIG.selectors.pageTitleStudentInfo);
            if (pageTitleSpan && pageTitleSpan.textContent) {
                const text = pageTitleSpan.textContent;
                console.log(`[${GM.info.script.name}] Found page title text: "${text}"`);

                const nameMatch = text.match(/Create Log Entry for (.*) \(ID (\d+)\)/);
                if (nameMatch && nameMatch.length >= 3) {
                    studentName = nameMatch[1].trim();
                    studentID = nameMatch[2].trim();
                    console.log(`[${GM.info.script.name}] Parsed Student Name: "${studentName}", ID: "${studentID}"`);
                } else {
                    throw new Error("Could not parse student name and ID from page title. Format expected: 'Create Log Entry for NAME (ID ID_NUMBER)'");
                }
            } else {
                throw new Error(`Page title student info element not found or empty: ${CONFIG.selectors.pageTitleStudentInfo}`);
            }

            // 2. Open and Select Section (whichever of the configured options is present)
            console.log(`[${GM.info.script.name}] Clicking Section Toggle Icon: ${CONFIG.selectors.sectionToggleIcon}`);
            await clickOpener(CONFIG.selectors.sectionToggleIcon);

            // Debug: Log available sections
            const availableSections = Array.from(document.querySelectorAll('#section_Picker a.pickListInlineLink')).map(a => `"${a.textContent.trim()}"`);
            console.log('[DEBUG] Available sections:', availableSections);

            console.log(`[${GM.info.script.name}] Attempting to select one of:`, CONFIG.selectors.sectionLinkTextOptions);
            const selectedSection = await waitForAnyElementAndClick(CONFIG.selectors.sectionLinksContainerSelector, CONFIG.selectors.sectionLinkTextOptions);
            console.log(`[${GM.info.script.name}] Selected "${selectedSection}"`);


            // 3. Open and Select Student in Contactees Menu
            console.log(`[${GM.info.script.name}] Clicking Student Toggle Icon: ${CONFIG.selectors.studentToggleIcon}`);
            await clickOpener(CONFIG.selectors.studentToggleIcon);
            const nameParts = studentName.split(' ');
            const lastName = nameParts[nameParts.length - 1];
            const firstName = nameParts.slice(0, -1).join(' ');
            const formattedName = `${lastName}, ${firstName}`;
            console.log(`[${GM.info.script.name}] Attempting to select Student: "${formattedName}" inside "${CONFIG.selectors.studentLinksContainerSelector}"`);
            await waitForElementAndClick(CONFIG.selectors.studentLinksContainerSelector, formattedName, false);
            console.log(`[${GM.info.script.name}] Selected student: ${formattedName}`);

            showToast('Auto-selection complete!', 'success');

        } catch (error) {
            console.error(`[${GM.info.script.name}] Automation error:`, error.message, error);
            showToast(`Error: ${error.message}`, 'error');
        }
    }

    // UI: Toast Notifications (floating button removed)
    function showToast(msg, type = 'info') {
        const t = document.createElement('div');
        t.textContent = msg;
        Object.assign(t.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '9999999',
            padding: '10px 14px',
            borderRadius: '8px',
            color: '#fff',
            background: type === 'error' ? '#d63939' : (type === 'success' ? '#2fa36b' : '#333'),
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            fontSize: '14px',
            fontFamily: 'sans-serif',
            maxWidth: '300px',
            textAlign: 'center',
        });
        document.body.appendChild(t);
        setTimeout(() => t.remove(), CONFIG.toastDisplayTimeMs);
    }

    console.log(`[${GM.info.script.name}] Waiting for ${CONFIG.initialAutomationDelayMs / 1000} seconds before running automation...`);
    setTimeout(runAutomation, CONFIG.initialAutomationDelayMs);

})();