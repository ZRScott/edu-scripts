// ==UserScript==
// @name         Count LiveLesson Log Entries with Scott, Zachary
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Counts how many times a student met with Scott, Zachary in a LiveLesson
// @match        https://www.connexus.com/log/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function countLiveLessons() {
        // Find all log grid tables on the page
        const logTables = document.querySelectorAll('table.logGridTable');
        let count = 0;

        logTables.forEach((table) => {
            const tableText = table.textContent || '';

            // Check if the entry lists 'Scott, Zachary' (or 'Zac Scott') and contains 'LiveLesson' in Contact Type
            const isRecorderScott = tableText.includes('Scott, Zachary') || tableText.includes('Scott, Zac');
            const isLiveLesson = tableText.includes('LiveLesson');

            if (isRecorderScott && isLiveLesson) {
                count++;
            }
        });

        alert(`Total LiveLesson entries with Scott, Zachary: ${count}`);
    }

    // Add a floating button to trigger the count
    const btn = document.createElement('button');
    btn.innerText = 'Count LiveLessons (Scott, Z.)';
    btn.style.position = 'fixed';
    btn.style.bottom = '20px';
    btn.style.right = '20px';
    btn.style.zIndex = '99999';
    btn.style.padding = '10px 15px';
    btn.style.backgroundColor = '#007bff';
    btn.style.color = '#ffffff';
    btn.style.border = 'none';
    btn.style.borderRadius = '5px';
    btn.style.cursor = 'pointer';

    btn.addEventListener('click', countLiveLessons);
    document.body.appendChild(btn);
})();