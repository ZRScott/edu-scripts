// ==UserScript==
// @name         Gradebook Grid Unit/Lesson Labels
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Extract "U# L#" from each column header's title, color-code by unit number, and display it under the number while keeping the hover tooltip
// @match        https://www.connexus.com/gradeBook/section/grid*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const unitColors = {
        1: '#FF6B6B',
        2: '#4CAF50',
        3: '#00BCD4',
        4: '#FF9800',
        5: '#8BC34A',
        6: '#00BCD4',
        7: '#FF9800',
        8: '#E91E63',
        9: '#8BC34A'
    };

    function getColorForUnit(unitNum) {
        if (unitColors[unitNum]) return unitColors[unitNum];
        // Fallback for any unit beyond the predefined list
        const fallbackHues = [0, 30, 60, 90, 150, 180, 270, 300, 330];
        const hue = fallbackHues[unitNum % fallbackHues.length];
        return `hsl(${hue}, 70%, 50%)`;
    }

    function showLabels() {
        const headers = document.querySelectorAll('tr.th th[title]');

        headers.forEach(th => {
            if (th.querySelector('.ul-label')) return;

            const titleText = th.getAttribute('title');
            if (!titleText) return;

            const match = titleText.match(/^U(\d+)\s*L(\d+)/i);
            if (!match) return;

            const unitNum = parseInt(match[1], 10);
            const shortLabel = match[0];
            const color = getColorForUnit(unitNum);

            const label = document.createElement('div');
            label.className = 'ul-label';
            label.textContent = shortLabel;
            label.style.color = color;
            label.style.fontSize = '10px';
            label.style.fontWeight = 'bold';
            label.style.whiteSpace = 'nowrap';
            label.style.textAlign = 'center';
            label.style.marginTop = '2px';
            label.style.display = 'block';

            th.style.height = 'auto';
            th.style.whiteSpace = 'normal';
            th.appendChild(label);

            // title attribute left in place intentionally so hover tooltip still works
        });
    }

    window.addEventListener('load', () => {
        setTimeout(showLabels, 500);
    });

    window.addEventListener('resize', () => {
        setTimeout(showLabels, 200);
    });
})();