// ==UserScript==
// @name         WebMail Menu
// @namespace    http://tampermonkey.net/
// @version      1.5
// @description  Dynamically modify menu, add buttons
// @author       Zac Scott
// @match        https://www.connexus.com/webmail*
// @grant        none
// @icon         https://www.svgrepo.com/show/286774/list-files-and-folders.svg
// ==/UserScript==

(function() {
    'use strict';

    // This function remains the same.
    function changeMenuTextAndURL() {
        const menuItems = document.querySelectorAll('li[data-ng-repeat="item in menuItems"]');

        menuItems.forEach(item => {
            const link = item.querySelector('a');
            if (link && link.title.includes('Send WebMail')) {
                link.textContent = '📊Grade Book';
                const studentIdMatch = link.href.match(/idWebuser=(\d+)/);
                if (studentIdMatch) {
                    const studentId = studentIdMatch[1];
                    link.href = `https://www.connexus.com/gradeBook/default.aspx?idWebUser=${studentId}`;
                }
            }
        });
    }

    // MODIFIED: This function now uses a placeholder to build the URL.
    function addButtonToMenu(buttonText, urlTemplate, titleText) {
        const contextMenu = document.querySelector('.contextMenu');
        if (contextMenu) {
            // Improved check to prevent adding duplicate buttons.
            const existingButton = Array.from(contextMenu.querySelectorAll('li a')).find(a => a.textContent === buttonText);
            if (!existingButton) {
                const menuItems = document.querySelectorAll('li[data-ng-repeat="item in menuItems"] a');
                const studentIdMatch = [...menuItems].map(link => link.href.match(/idWebuser=(\d+)/)).find(match => match);
                if (studentIdMatch) {
                    const studentId = studentIdMatch[1];
                    // FIX: Replaces the placeholder with the actual studentId.
                    const fullURL = urlTemplate.replace('%%STUDENT_ID%%', studentId);

                    const newMenuItem = document.createElement('li');
                    newMenuItem.classList.add('ng-scope');
                    const newLink = document.createElement('a');
                    newLink.href = fullURL;
                    newLink.title = titleText;
                    newLink.role = "menuitem";
                    newLink.target = "_blank";
                    newLink.classList.add('ng-binding');
                    newLink.textContent = buttonText;
                    newMenuItem.appendChild(newLink);
                    contextMenu.appendChild(newMenuItem);
                }
            }
        }
    }

    setInterval(function() {
        changeMenuTextAndURL();
        // FIX: All URLs now use the '%%STUDENT_ID%%' placeholder.
        addButtonToMenu('🔍Log Search', 'https://www.connexus.com/log/default.aspx?idWebuser=%%STUDENT_ID%%', 'Go to Log Search');
        addButtonToMenu('📜Transcript', 'https://www.connexus.com/gradeBook/progressReport/transcript/default.aspx?idWebuser=%%STUDENT_ID%%&type=highSchool', 'Go to Transcript');
        addButtonToMenu('⭐STARmail', 'https://www.connexus.com/dataview/17632?idWebuser=%%STUDENT_ID%%', 'Go to STARmail');
        addButtonToMenu('📚Assessments Completed', 'https://www.connexus.com/assessments/results/listTaken.aspx?idWebuser=%%STUDENT_ID%%', 'Go to Assessments Completed');
    }, 1000);

})();
