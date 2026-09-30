// ==UserScript==
// @name         Move Physical Science to Top
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Moves the Physical Science section row to the top of the section summary table.
// @match        https://www.connexus.com/gradeBook*
// @grant        none
// ==/UserScript==

(function() {
    'use me';

    function movePhysicalScienceToTop() {
        // Find the table containing section summary
        const table = document.getElementById('sections');
        if (!table) return;

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        // Find the row containing 'Physical Science'
        const rows = Array.from(tbody.rows);
        const targetRow = rows.find(row => row.textContent.includes('Physical Science'));

        if (!targetRow) return;

        // Find the header row (has class 'th')
        const headerRow = tbody.querySelector('tr.th');

        if (headerRow && headerRow.nextSibling !== targetRow) {
            // Insert Physical Science directly after the header row
            headerRow.parentNode.insertBefore(targetRow, headerRow.nextSibling);
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', movePhysicalScienceToTop);
    } else {
        movePhysicalScienceToTop();
    }
})();