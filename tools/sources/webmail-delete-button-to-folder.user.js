// ==UserScript==
// @name         Webmail Delete Button to Folder
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Change delete button to move to trash instead of deleting
// @match        https://www.connexus.com/webmail*
// @grant        none
// @icon         https://www.svgrepo.com/show/489661/garbage-in-trash-bin-recycle-bin-delete.svg
// ==/UserScript==

(function() {
    'use strict';

    function modifyDeleteButton() {
        const deleteButton = document.querySelector('button[data-ng-click="deleteMessages()"]');

        if (deleteButton) {
            // Check if we've already modified this button
            if (deleteButton.getAttribute('data-modified') === 'true') {
                return;
            }

            // Modify the click event using Angular
            const scope = angular.element(deleteButton).scope();

            if (scope && scope.$parent) {
                // Replace the original deleteMessages with moveMessages
                scope.$parent.deleteMessages = function() {
                    // Call moveMessages instead
                    scope.$parent.moveMessages('18847998', 'The Outer Abyss'); // replace the 8 digit number with your folder number found in the URL when you are in the folder.
                };

                // Mark as modified to prevent duplicate processing
                deleteButton.setAttribute('data-modified', 'true');
                console.log('Delete button modified to move to Trash');
            } else {
                console.error('Could not find Angular scope');
            }
        }
    }

    // Set up MutationObserver to watch for DOM changes
    function observeDOM() {
        const observer = new MutationObserver(function(mutations) {
            modifyDeleteButton();
        });

        // Start observing the document with the configured parameters
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Wait for Angular to load and then start observing
    function init() {
        if (typeof angular !== 'undefined') {
            // Initial run
            setTimeout(modifyDeleteButton, 1000);
            // Set up observer
            observeDOM();
        } else {
            setTimeout(init, 500);
        }
    }

    // Start the script
    init();
})();

