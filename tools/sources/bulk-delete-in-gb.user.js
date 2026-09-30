// ==UserScript==
// @name         Bulk Delete in GB
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Mark multiple assignments for reset execute them sequentially after page reloads.
// @author       Zac Scott
// @match        https://www.connexus.com/gradeBook/default*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const QUEUE_KEY = 'batchDeleteQueue';
    const ACTIVE_KEY = 'batchDeleteActive';

    // --- Helper Function to Extract __doPostBack Args ---
    function getPostBackArgs(href) {
        const match = href.match(/javascript:__doPostBack\('([^']*)','([^']*)'\)/);
        if (match && match.length >= 2) {
            // Returns an object { target: '...', argument: '...' }
            return { target: match[1], argument: match[2] || '' };
        }
        return null;
    }

    // --- Add Checkboxes and UI Elements ---
    function setupUI() {
        const deleteLinks = document.querySelectorAll('a[href*="javascript:__doPostBack"][href*="grades$ctl"]'); // Adjust selector if needed
        let queue = GM_getValue(QUEUE_KEY, []);

        deleteLinks.forEach((link, index) => {
            const args = getPostBackArgs(link.href);
            if (!args) return; // Skip if we can't parse args

            const checkboxId = `batch-cb-${index}`;
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = checkboxId;
            checkbox.style.marginLeft = '5px';
            checkbox.style.verticalAlign = 'middle';
            checkbox.dataset.target = args.target; // Store target ID

            // Check if this item is already in the queue
            checkbox.checked = queue.some(item => item.target === args.target);

            checkbox.addEventListener('change', (event) => {
                let currentQueue = GM_getValue(QUEUE_KEY, []);
                const currentTarget = event.target.dataset.target;
                if (event.target.checked) {
                    // Add to queue if not already present
                    if (!currentQueue.some(item => item.target === currentTarget)) {
                        currentQueue.push({ target: currentTarget, argument: args.argument }); // Store both args
                        console.log('Added to queue:', currentTarget);
                    }
                } else {
                    // Remove from queue
                    currentQueue = currentQueue.filter(item => item.target !== currentTarget);
                    console.log('Removed from queue:', currentTarget);
                }
                GM_setValue(QUEUE_KEY, currentQueue);
            });

            // Insert checkbox near the link (adjust placement as needed)
            link.parentNode.insertBefore(checkbox, link.nextSibling);
        });

        // Add Control Buttons (only if not already present)
        if (!document.getElementById('batch-delete-start')) {
            const controlsDiv = document.createElement('div');
            controlsDiv.style.padding = '10px';
            controlsDiv.style.border = '1px solid #ccc';
            controlsDiv.style.marginTop = '15px';
            controlsDiv.style.backgroundColor = '#f0f0f0';

            const startButton = document.createElement('button');
            startButton.id = 'batch-delete-start';
            startButton.textContent = 'Start Batch Delete Marked Items';
            startButton.style.marginRight = '10px';
            startButton.onclick = startBatchDelete;
            controlsDiv.appendChild(startButton);

            const clearButton = document.createElement('button');
            clearButton.id = 'batch-delete-clear';
            clearButton.textContent = 'Clear Marked Items Queue';
            clearButton.onclick = clearQueue;
            controlsDiv.appendChild(clearButton);

             // Add somewhere prominent, like the top of the body or near the table
            document.body.insertBefore(controlsDiv, document.body.firstChild);
        }
    }

    // --- Batch Deletion Logic ---
    function startBatchDelete() {
        let queue = GM_getValue(QUEUE_KEY, []);
        if (queue.length === 0) {
            alert('No items marked for deletion.');
            return;
        }

        if (confirm(`You are about to delete ${queue.length} item(s) sequentially. Continue?`)) {
            GM_setValue(ACTIVE_KEY, true);
            console.log('Starting batch delete...');
            // Trigger the first deletion immediately
            processNextItem();
        }
    }

    function processNextItem() {
        if (!GM_getValue(ACTIVE_KEY, false)) {
            console.log('Batch process not active.');
            return; // Stop if not active
        }

        let queue = GM_getValue(QUEUE_KEY, []);
        console.log('Processing queue. Items left:', queue.length);


        if (queue.length > 0) {
            const itemToDelete = queue.shift(); // Get the first item
            GM_setValue(QUEUE_KEY, queue); // Save the updated queue (item removed)

            console.log('Attempting to delete:', itemToDelete.target);

            // IMPORTANT: Find the corresponding element *on the current page*
            // This assumes the target ID remains stable across reloads.
            // We call __doPostBack directly, bypassing the original link's confirm dialog.
            try {
                 // Check if the function exists before calling
                if (typeof __doPostBack === 'function') {
                     // Small delay might sometimes help ensure state is saved before navigation
                     setTimeout(() => {
                        console.log(`Executing: __doPostBack('${itemToDelete.target}', '${itemToDelete.argument}')`);
                        __doPostBack(itemToDelete.target, itemToDelete.argument);
                     }, 150); // 150ms delay
                } else {
                    console.error('__doPostBack function not found on this page!');
                    alert('Error: __doPostBack function not found. Stopping batch process.');
                    clearQueueAndFlag(); // Stop the process
                }
            } catch (e) {
                console.error('Error executing __doPostBack:', e);
                alert('An error occurred during deletion. Stopping batch process. Check console.');
                clearQueueAndFlag(); // Stop the process on error
            }
        } else {
            console.log('Batch delete queue empty. Finishing.');
            alert('Batch deletion complete!');
            clearQueueAndFlag(); // All done
        }
    }

     function clearQueueAndFlag() {
        GM_deleteValue(QUEUE_KEY);
        GM_deleteValue(ACTIVE_KEY);
        console.log('Queue and active flag cleared.');
     }

    function clearQueue() {
         if (confirm('Are you sure you want to clear the list of marked items?')) {
             clearQueueAndFlag();
             alert('Marked items queue cleared. Refresh the page to update checkboxes.');
             // Optionally, reload or visually clear checkboxes here
             location.reload(); // Easiest way to reset UI
         }
    }

    // --- Run on Page Load ---
    // 1. Add UI elements
    setupUI();

    // 2. Check if we are in the middle of a batch delete and process the next item
    if (GM_getValue(ACTIVE_KEY, false)) {
        // Add a small delay to ensure the page is fully ready, especially the __doPostBack function
        setTimeout(processNextItem, 500); // Delay processing slightly after page load
    }

    // --- Tampermonkey Menu Command ---
    GM_registerMenuCommand('Clear Batch Delete Queue', clearQueue);


})();
