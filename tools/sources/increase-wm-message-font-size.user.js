// ==UserScript==
// @name         Increase WM Message Font Size
// @version      1.1
// @description  Increases the font size of message bodies.
// @author       Zac Scott
// @match        https://www.connexus.com/webmail*
// @grant        none
// @icon         https://www.svgrepo.com/show/439162/font-size.svg
// ==/UserScript==

(function() {
    'use strict';

    const targetSelector = '.messageBody.ng-binding';
    const newFontSize = '17px'; // The desired font size

    // Function to apply the style
    function applyFontSize(element) {
        // Check if the element already has the style applied by this script
        // This helps prevent applying the style multiple times if the element is processed again
        if (!element.dataset.fontSizeApplied) {
             // Applying inline style directly
             element.style.fontSize = newFontSize;

            // Alternatively, you could add a class and define the style in a stylesheet:
            // element.classList.add('my-larger-font');
            // Then inject a style tag with:
            // .my-larger-font { font-size: 14px !important; } // Use !important if needed

            element.dataset.fontSizeApplied = 'true'; // Mark the element as processed
        }
    }

    // Function to process existing and new elements
    function processElements() {
        const elements = document.querySelectorAll(targetSelector);
        elements.forEach(applyFontSize);
    }

    // Use MutationObserver to detect when new elements are added to the DOM
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    // Check if the added node itself matches the selector
                    if (node.matches && node.matches(targetSelector)) {
                        applyFontSize(node);
                    }
                    // Also check for matching elements within the added node (if it's an element)
                    if (node.nodeType === 1) { // Check if it's an element node
                        node.querySelectorAll(targetSelector).forEach(applyFontSize);
                    }
                });
            }
        });
    });

    // Start observing the document body for changes
    // subtree: observe changes in the entire subtree of the target
    // childList: observe changes to the list of children of the target
    observer.observe(document.body, { subtree: true, childList: true });

    // Process elements that are already in the DOM when the script runs
    processElements();

    // Optional: You might want to re-process elements on window load to catch anything missed
    window.addEventListener('load', processElements);

})();
