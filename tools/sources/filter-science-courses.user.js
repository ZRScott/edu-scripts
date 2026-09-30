// ==UserScript==
// @name         Filter Science Courses
// @namespace    http://tampermonkey.net/
// @version      2.5
// @description  Filter high school courses and Section/Location menu to show Physical Science S1 and Homeroom classes.
// @author       Glenn Rusher
// @icon         data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%230078d4"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg>
// @match        https://www.connexus.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ---------------------------------------------------------
    // 1. FILTER MAIN COURSES DROPDOWN (#sections)
    // ---------------------------------------------------------
    const scienceKeywords = ['Physical Science'];
    const finishedText = 'Starts 1/19/2027';
    const coursesToExclude = [''];
    const desiredOrder = [
        'Physical Science A (All Sections)',
        'Physical Science S1 A (ID 2173877)',
        'Physical Science S1 B (ID 2237710)',
        'Honors Physical Science A (ID 2173883)',
        'Physical Science B (All Sections)',
        'CR Physical Science A (ID 2173815)',
        'CR Physical Science B (ID 2241135)',
    ];
    const courseToAutoSelect = 'Physical Science A (All Sections)';

    function normalize(text) {
        return text.replace(/\*\s*$/, '').trim();
    }

    function filterMainSections() {
        const selectElement = document.getElementById('sections');
        if (!selectElement || selectElement.dataset.filtered) return;

        const filteredOptions = [];
        Array.from(selectElement.options).forEach(option => {
            option.text = option.text.trim();
            const normalizedText = normalize(option.text);
            const isScienceCourse = scienceKeywords.some(keyword => normalizedText.includes(keyword));
            const isFinishedCourse = option.text.includes(finishedText);
            const isExcludedCourse = coursesToExclude.includes(normalizedText);

            if (isScienceCourse && !isFinishedCourse && !isExcludedCourse) {
                filteredOptions.push(option);
            }
        });

        filteredOptions.sort((a, b) => {
            let indexA = desiredOrder.indexOf(normalize(a.text));
            let indexB = desiredOrder.indexOf(normalize(b.text));
            if (indexA === -1) indexA = desiredOrder.length;
            if (indexB === -1) indexB = desiredOrder.length;
            return indexA - indexB;
        });

        selectElement.innerHTML = '';
        filteredOptions.forEach(option => selectElement.appendChild(option));
        selectElement.dataset.filtered = 'true';

        const urlParams = new URLSearchParams(window.location.search);
        const hasIdSection = urlParams.has('idSection') && urlParams.get('idSection').trim() !== '';

        if (!hasIdSection) {
            const targetOption = filteredOptions.find(option => normalize(option.text) === courseToAutoSelect);
            if (targetOption) {
                selectElement.value = targetOption.value;
                const postbackElem = document.getElementById('isSectionPostback');
                if (postbackElem) postbackElem.value = 'true';
                if (typeof __doPostBack === 'function') {
                    setTimeout(() => __doPostBack('sections', ''), 0);
                }
            }
        }
    }

    // ---------------------------------------------------------
    // 2. FILTER SECTION/LOCATION DROPDOWN (#sectionLocationId)
    // ---------------------------------------------------------
    function filterSectionLocation() {
        const selectLoc = document.getElementById('sectionLocationId');
        if (!selectLoc) return;

        let modified = false;

        // Remove non-matching options directly from the native HTML <select> element
        Array.from(selectLoc.options).forEach(option => {
            const text = option.textContent.trim();
            const isDefault = text === 'Select Section/Location';
            const isS1 = text.includes('Physical Science S1');
            const isHomeroom = text.includes("Mr. Scott's 11th Grade Homeroom");

            if (!isDefault && !isS1 && !isHomeroom) {
                option.remove();
                modified = true;
            }
        });

        // Trigger Chosen.js re-render if options were removed
        if (modified) {
            selectLoc.dispatchEvent(new Event('chosen:updated', { bubbles: true }));
            if (window.jQuery) {
                window.jQuery(selectLoc).trigger('chosen:updated');
            }
        }
    }

    // Run initial execution
    filterMainSections();
    filterSectionLocation();

    // Observe dynamic changes (e.g., AJAX updates or asynchronous page loads)
    const observer = new MutationObserver(() => {
        filterMainSections();
        filterSectionLocation();
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();