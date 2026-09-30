// ==UserScript==
// @name         Sections & Students
// @namespace    http://tampermonkey.net/
// @version      3.4
// @description  Open multiple student logs or RCA points tabs from selected checkboxes + ID bulk checker + notes + alarm contact label + phone
// @match        https://www.connexus.com/sectionsandstudents*
// @grant        GM_xmlhttpRequest
// @connect      connexus.com
// @icon         https://www.svgrepo.com/show/440478/atronaut.svg
// ==/UserScript==
(function() {
    'use strict';

    function isMyStudentsPage() {
        return window.location.hash.includes('mystudents');
    }

    // ── Caches ───────────────────────────────────────────────────────────────────
    const notesCache = new Map();
    const phoneCache = new Map();

    // ── Styles ──────────────────────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        tr.cx-row-selected td {
            background-color: #e8d0e4 !important;
        }

        .cx-notes-cell, .cx-phone-cell {
            font-size: 12px;
            color: #333;
            max-width: 180px;
            white-space: normal;
            overflow: visible;
            word-break: break-word;
            cursor: default;
            padding: 2px 4px !important;
            position: relative;
            text-align: center !important;
        }

        .cx-notes-cell.empty, .cx-phone-cell.empty {
            color: #bbb;
            font-style: italic;
        }

        .cx-notes-header, .cx-phone-header {
            font-size: 10px;
            font-weight: bold;
            color: #651e56;
            text-align: center !important;
            white-space: nowrap;
            padding: 2px 6px !important;
        }

        .cx-load-note-btn, .cx-load-phone-btn {
            font-size: 10px;
            background: #722362;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 2px 6px;
            cursor: pointer;
            opacity: 0.7;
            transition: opacity 0.2s;
        }

        .cx-load-note-btn:hover, .cx-load-phone-btn:hover {
            opacity: 1;
        }

        .cx-notes-tooltip {
            position: fixed;
            background: #722362;
            color: #fff;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 11px;
            max-width: 300px;
            white-space: pre-wrap;
            word-break: break-word;
            z-index: 999998;
            pointer-events: none;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            display: none;
        }

        #bulk-checker-panel {
            position: fixed;
            bottom: 10px;
            right: 10px;
            width: 220px;
            background: #e8d0e4;
            border: 2px solid #651e56;
            border-radius: 10px;
            padding: 10px;
            z-index: 999999;
            font-family: Arial, sans-serif;
            font-size: 11px;
            box-shadow: 0 4px 15px rgba(101,30,86,0.3);
            transition: height 0.2s ease, padding 0.2s ease, width 0.2s ease;
        }

        #bulk-checker-panel.collapsed .cx-collapsible {
            display: none;
        }

        #bulk-checker-panel.collapsed {
            padding-bottom: 6px;
        }

        #bulk-checker-panel.expanded {
            width: 340px;
        }

        #bulk-checker-panel.expanded #cx-id-input {
            height: 60vh;
        }

        #cx-drag-handle {
            font-weight: bold;
            margin-bottom: 6px;
            cursor: move;
            user-select: none;
            color: #651e56;
            font-size: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        #cx-drag-handle-buttons {
            display: flex;
            gap: 4px;
        }

        #cx-collapse-btn, #cx-expand-btn {
            background: none;
            border: none;
            color: #651e56;
            cursor: pointer;
            font-size: 14px;
            line-height: 1;
            padding: 0 2px;
            opacity: 0.7;
            transition: opacity 0.2s;
        }

        #cx-collapse-btn:hover, #cx-expand-btn:hover {
            opacity: 1;
        }

        #cx-id-input {
            width: 100%;
            height: 60px;
            font-size: 11px;
            box-sizing: border-box;
            resize: vertical;
            border: 1px solid #722362;
            border-radius: 4px;
            padding: 4px;
            background: #f5eaf3;
            color: #651e56;
            transition: height 0.2s ease;
        }

        #cx-status {
            margin-top: 6px;
            font-size: 10px;
            color: #651e56;
            min-height: 14px;
        }

        .cx-btn-wrap {
            display: flex;
            justify-content: center;
            margin-top: 8px;
        }

        .cx-button {
            --line_color: #5c1a4d;
            --back_color: #f4b3d7;
            position: relative;
            z-index: 0;
            width: 180px;
            height: 44px;
            font-size: 11px;
            font-weight: bold;
            color: var(--line_color);
            letter-spacing: 2px;
            transition: all 0.3s ease;
            background: none;
            border: none;
            cursor: pointer;
        }

        .cx-button.cx-clicked {
            --line_color: #3aa19f;
            --back_color: #5dc0be;
            color: var(--line_color);
        }

        .cx-button__text {
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100%;
            height: 100%;
        }
        .cx-button::before, .cx-button::after,
        .cx-button__text::before, .cx-button__text::after {
            content: "";
            position: absolute;
            height: 3px;
            border-radius: 2px;
            background: var(--line_color);
            transition: all 0.5s ease;
        }
        .cx-button::before { top: 0; left: 54px; width: calc(100% - 56px * 2 - 16px); }
        .cx-button::after  { top: 0; right: 54px; width: 8px; }
        .cx-button__text::before { bottom: 0; right: 54px; width: calc(100% - 56px * 2 - 16px); }
        .cx-button__text::after  { bottom: 0; left: 54px; width: 8px; }
        .cx-button__line {
            position: absolute; top: 0; width: 56px; height: 100%; overflow: hidden;
        }
        .cx-button__line::before {
            content: ""; position: absolute; top: 0; width: 150%; height: 100%;
            box-sizing: border-box; border-radius: 300px; border: solid 3px var(--line_color);
        }
        .cx-button__line:nth-child(1), .cx-button__line:nth-child(1)::before { left: 0; }
        .cx-button__line:nth-child(2), .cx-button__line:nth-child(2)::before { right: 0; }
        .cx-button:hover { letter-spacing: 6px; }
        .cx-button:hover::before, .cx-button:hover .cx-button__text::before { width: 8px; }
        .cx-button:hover::after,  .cx-button:hover .cx-button__text::after  { width: calc(100% - 56px * 2 - 16px); }
        .cx-button__drow1, .cx-button__drow2 {
            position: absolute; z-index: -1; border-radius: 16px; transform-origin: 16px 16px;
        }
        .cx-button__drow1 { top: -16px; left: 40px; width: 32px; height: 0; transform: rotate(30deg); }
        .cx-button__drow2 { top: 44px; left: 77px; width: 32px; height: 0; transform: rotate(-127deg); }
        .cx-button__drow1::before, .cx-button__drow1::after,
        .cx-button__drow2::before, .cx-button__drow2::after { content: ""; position: absolute; }
        .cx-button__drow1::before { bottom: 0; left: 0; width: 0; height: 32px; border-radius: 16px; transform-origin: 16px 16px; transform: rotate(-60deg); }
        .cx-button__drow1::after  { top: -10px; left: 45px; width: 0; height: 32px; border-radius: 16px; transform-origin: 16px 16px; transform: rotate(69deg); }
        .cx-button__drow2::before { bottom: 0; left: 0; width: 0; height: 32px; border-radius: 16px; transform-origin: 16px 16px; transform: rotate(-146deg); }
        .cx-button__drow2::after  { bottom: 26px; left: -40px; width: 0; height: 32px; border-radius: 16px; transform-origin: 16px 16px; transform: rotate(-262deg); }
        .cx-button__drow1, .cx-button__drow1::before, .cx-button__drow1::after,
        .cx-button__drow2, .cx-button__drow2::before, .cx-button__drow2::after { background: var(--back_color); }
        .cx-button:hover .cx-button__drow1        { animation: cx-drow1 ease-in 0.06s forwards; }
        .cx-button:hover .cx-button__drow1::before { animation: cx-drow2 linear 0.08s 0.06s forwards; }
        .cx-button:hover .cx-button__drow1::after  { animation: cx-drow3 linear 0.03s 0.14s forwards; }
        .cx-button:hover .cx-button__drow2        { animation: cx-drow4 linear 0.06s 0.2s forwards; }
        .cx-button:hover .cx-button__drow2::before { animation: cx-drow3 linear 0.03s 0.26s forwards; }
        .cx-button:hover .cx-button__drow2::after  { animation: cx-drow5 linear 0.06s 0.32s forwards; }
        @keyframes cx-drow1 { 0% { height: 0; } 100% { height: 100px; } }
        @keyframes cx-drow2 { 0% { width: 0; opacity: 0; } 10% { opacity: 0; } 11% { opacity: 1; } 100% { width: 120px; } }
        @keyframes cx-drow3 { 0% { width: 0; } 100% { width: 80px; } }
        @keyframes cx-drow4 { 0% { height: 0; } 100% { height: 120px; } }
        @keyframes cx-drow5 { 0% { width: 0; } 100% { width: 124px; } }

        /* ── RCA Points Menu ── */
        #cx-rca-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.35);
            z-index: 1000000;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        #cx-rca-menu {
            background: #f5eaf3;
            border: 2px solid #651e56;
            border-radius: 12px;
            padding: 20px 24px;
            width: 300px;
            font-family: Arial, sans-serif;
            box-shadow: 0 6px 24px rgba(101,30,86,0.35);
        }

        #cx-rca-menu h3 {
            margin: 0 0 14px 0;
            color: #651e56;
            font-size: 14px;
            text-align: center;
            letter-spacing: 1px;
        }

        .cx-rca-categories {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 14px;
        }

        .cx-rca-categories label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            color: #651e56;
            cursor: pointer;
            font-weight: bold;
            padding: 4px 6px;
            border-radius: 6px;
            transition: background 0.15s;
        }

        .cx-rca-categories label:hover {
            background: #e8d0e4;
        }

        .cx-rca-categories input[type="radio"] {
            accent-color: #722362;
            width: 14px;
            height: 14px;
            cursor: pointer;
            flex-shrink: 0;
        }

        #cx-rca-comment {
            width: 100%;
            height: 60px;
            font-size: 11px;
            box-sizing: border-box;
            resize: vertical;
            border: 1px solid #722362;
            border-radius: 4px;
            padding: 6px;
            background: #fff;
            color: #333;
            margin-bottom: 14px;
        }

        #cx-rca-comment:focus {
            outline: none;
            border-color: #5dc0be;
            box-shadow: 0 0 0 2px rgba(93,192,190,0.3);
        }

        .cx-rca-menu-footer {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
        }

        .cx-rca-cancel-btn {
            background: none;
            border: 1px solid #722362;
            color: #722362;
            border-radius: 6px;
            padding: 6px 14px;
            font-size: 11px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s, color 0.2s;
        }

        .cx-rca-cancel-btn:hover {
            background: #722362;
            color: #fff;
        }

        .cx-rca-submit-btn {
            background: #722362;
            border: none;
            color: #fff;
            border-radius: 6px;
            padding: 6px 14px;
            font-size: 11px;
            font-weight: bold;
            cursor: pointer;
            transition: background 0.2s;
        }

        .cx-rca-submit-btn:hover {
            background: #651e56;
        }

        #cx-rca-error {
            color: #c0392b;
            font-size: 10px;
            margin-bottom: 8px;
            min-height: 14px;
            text-align: center;
        }
    `;
    document.head.appendChild(style);

    // ── Tooltip ─────────────────────────────────────────────────────────────────
    const tooltip = document.createElement('div');
    tooltip.className = 'cx-notes-tooltip';
    document.body.appendChild(tooltip);

    // ── Panel ────────────────────────────────────────────────────────────────────
    const panel = document.createElement('div');
    panel.id = 'bulk-checker-panel';
    panel.innerHTML = `
        <div id="cx-drag-handle">
            <span>📋 ID Checker</span>
            <div id="cx-drag-handle-buttons">
                <button id="cx-expand-btn" title="Expand">⛶</button>
                <button id="cx-collapse-btn" title="Collapse">🔽</button>
            </div>
        </div>
        <div class="cx-collapsible">
            <textarea id="cx-id-input" placeholder="Paste IDs here..."></textarea>
            <div class="cx-btn-wrap">
                <button id="cx-check-btn" class="cx-button">
                    <span class="cx-button__line"></span>
                    <span class="cx-button__line"></span>
                    <span class="cx-button__text">✔ CHECK IDs</span>
                    <span class="cx-button__drow1"></span>
                    <span class="cx-button__drow2"></span>
                </button>
            </div>
            <div id="cx-status"></div>
        </div>
    `;
    document.body.appendChild(panel);

    function updatePanelVisibility() {
        panel.style.display = isMyStudentsPage() ? 'block' : 'none';
    }

    const collapseBtn = document.getElementById('cx-collapse-btn');
    collapseBtn.addEventListener('click', () => {
        panel.classList.toggle('collapsed');
        collapseBtn.textContent = panel.classList.contains('collapsed') ? '🔼' : '🔽';
    });

    const expandBtn = document.getElementById('cx-expand-btn');
    expandBtn.addEventListener('click', () => {
        panel.classList.toggle('expanded');
        expandBtn.textContent = panel.classList.contains('expanded') ? '🗗' : '⛶';
        expandBtn.title = panel.classList.contains('expanded') ? 'Collapse to normal size' : 'Expand';
    });

    const handle = document.getElementById('cx-drag-handle');
    let isDragging = false, startX, startY, startLeft, startBottom;
    handle.addEventListener('mousedown', (e) => {
        if (e.target === collapseBtn || e.target === expandBtn) return;
        isDragging = true;
        startX = e.clientX; startY = e.clientY;
        const rect = panel.getBoundingClientRect();
        startLeft = rect.left;
        startBottom = window.innerHeight - rect.bottom;
        e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panel.style.left   = (startLeft + (e.clientX - startX)) + 'px';
        panel.style.right  = 'auto';
        panel.style.bottom = (startBottom - (e.clientY - startY)) + 'px';
    });
    document.addEventListener('mouseup', () => isDragging = false);

    const checkBtn = document.getElementById('cx-check-btn');
    checkBtn.addEventListener('click', () => {
        const raw    = document.getElementById('cx-id-input').value;
        const ids    = raw.match(/\d{7}/g);
        const status = document.getElementById('cx-status');

        if (!ids || ids.length === 0) {
            status.textContent = '⚠️ No valid IDs found.';
            return;
        }

        let checked = 0, notFound = [];
        ids.forEach(id => {
            const checkbox = document.querySelector(`input[type="checkbox"][value="${id}"]`);
            if (checkbox) {
                if (!checkbox.checked) {
                    checkbox.checked = true;
                    const ngModelCtrl = angular.element(checkbox).controller('ngModel');
                    if (ngModelCtrl) {
                        ngModelCtrl.$setViewValue(true);
                        ngModelCtrl.$commitViewValue();
                    }
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
                checked++;
            } else {
                notFound.push(id);
            }
        });

        checkBtn.classList.add('cx-clicked');

        let msg = `✅ Checked: ${checked}`;
        if (notFound.length > 0) msg += `\n❌ Not found: ${notFound.join(', ')}`;
        status.textContent = msg;
        status.style.whiteSpace = 'pre';
    });

    document.getElementById('cx-id-input').addEventListener('input', () => {
        checkBtn.classList.remove('cx-clicked');
    });

    // ── Notes helpers ────────────────────────────────────────────────────────────
    function attachTooltip(cell, text) {
        cell.addEventListener('mouseenter', (e) => {
            tooltip.textContent = text;
            tooltip.style.display = 'block';
            tooltip.style.left = Math.min(e.clientX + 12, window.innerWidth - 320) + 'px';
            tooltip.style.top = (e.clientY - 10) + 'px';
        });
        cell.addEventListener('mousemove', (e) => {
            tooltip.style.left = Math.min(e.clientX + 12, window.innerWidth - 320) + 'px';
            tooltip.style.top = (e.clientY - 10) + 'px';
        });
        cell.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
    }

    function stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent.trim();
    }

    function fetchNotes(studentId) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://www.connexus.com/dataview/1012?idWebuser=${studentId}`,
                onload: (res) => {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(res.responseText, 'text/html');
                        const textarea = doc.querySelector('#ContactNotesStaffOnly');
                        if (!textarea) return resolve('');
                        const raw = textarea.value || textarea.textContent || '';
                        resolve(stripHtml(raw).trim());
                    } catch(e) {
                        resolve('');
                    }
                },
                onerror: () => resolve('')
            });
        });
    }

    // ── Phone helpers ────────────────────────────────────────────────────────────
    function fetchPhone(studentId) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://www.connexus.com/dataview/3325?idWebuser=${studentId}`,
                onload: (res) => {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(res.responseText, 'text/html');
                        const input = doc.querySelector('#contact_Mobile_Phone');
                        const phone = input ? (input.value || '').trim() : '';
                        resolve(phone);
                    } catch(e) {
                        resolve('');
                    }
                },
                onerror: () => resolve('')
            });
        });
    }

    function applyPhoneToCell(cell, studentId, phone) {
        phoneCache.set(studentId, phone);
        if (phone) {
            cell.textContent = phone;
            cell.classList.remove('empty');
            attachTooltip(cell, phone);
        } else {
            cell.textContent = '—';
            cell.classList.add('empty');
        }
    }

    function loadSinglePhone(studentId, cell) {
        cell.textContent = '...';
        fetchPhone(studentId).then(phone => applyPhoneToCell(cell, studentId, phone));
    }

    function applyNoteToCell(cell, studentId, notes) {
        notesCache.set(studentId, notes);
        if (notes) {
            cell.textContent = notes;
            cell.classList.remove('empty');
            attachTooltip(cell, notes);
        } else {
            cell.textContent = '—';
            cell.classList.add('empty');
        }
    }

    function loadSingleNote(studentId, cell) {
        cell.textContent = '...';
        fetchNotes(studentId).then(notes => applyNoteToCell(cell, studentId, notes));
    }

    function injectNotesHeader() {
        if (document.querySelector('th.cx-notes-header')) return;
        const headerRow = document.querySelector('thead tr');
        if (!headerRow) return;
        const th = document.createElement('th');
        th.className = 'cx-notes-header';
        th.textContent = '📝 Notes';
        headerRow.appendChild(th);
    }

    function injectPhoneHeader() {
        if (document.querySelector('th.cx-phone-header')) return;
        const headerRow = document.querySelector('thead tr');
        if (!headerRow) return;
        const th = document.createElement('th');
        th.className = 'cx-phone-header';
        th.textContent = '📱 Phone';
        headerRow.appendChild(th);
    }

    function injectRowButtons() {
        if (!isMyStudentsPage()) return;
        injectNotesHeader();
        injectPhoneHeader();

        document.querySelectorAll('tr[ng-repeat]').forEach(row => {
            const checkbox = row.querySelector('input[type="checkbox"][id^="studentsCheckBox_"]');
            if (!checkbox) return;
            const studentId = checkbox.value;

            // ── Notes cell ──
            let notesCell = row.querySelector('td.cx-notes-cell');
            if (notesCell) {
                if (notesCell !== row.lastElementChild && !row.querySelector('td.cx-phone-cell')) {
                    notesCell.remove();
                    row.appendChild(notesCell);
                }
            } else {
                notesCell = document.createElement('td');
                notesCell.className = 'cx-notes-cell';
                if (notesCache.has(studentId)) {
                    const notes = notesCache.get(studentId);
                    if (notes) { notesCell.textContent = notes; attachTooltip(notesCell, notes); }
                    else { notesCell.textContent = '—'; notesCell.classList.add('empty'); }
                } else {
                    const miniBtn = document.createElement('button');
                    miniBtn.className = 'cx-load-note-btn';
                    miniBtn.textContent = '📝';
                    miniBtn.addEventListener('click', (e) => { e.stopPropagation(); miniBtn.remove(); loadSingleNote(studentId, notesCell); });
                    notesCell.appendChild(miniBtn);
                }
                row.appendChild(notesCell);
            }

            // ── Phone cell ──
            let phoneCell = row.querySelector('td.cx-phone-cell');
            if (!phoneCell) {
                phoneCell = document.createElement('td');
                phoneCell.className = 'cx-phone-cell';
                if (phoneCache.has(studentId)) {
                    const phone = phoneCache.get(studentId);
                    if (phone) { phoneCell.textContent = phone; attachTooltip(phoneCell, phone); }
                    else { phoneCell.textContent = '—'; phoneCell.classList.add('empty'); }
                } else {
                    const miniBtn = document.createElement('button');
                    miniBtn.className = 'cx-load-phone-btn';
                    miniBtn.textContent = '📱';
                    miniBtn.addEventListener('click', (e) => { e.stopPropagation(); miniBtn.remove(); loadSinglePhone(studentId, phoneCell); });
                    phoneCell.appendChild(miniBtn);
                }
                row.appendChild(phoneCell);
            }
        });
    }

    // ── Sync row highlights ───────────────────────────────────────────────────────
    function syncAllRowHighlights() {
        document.querySelectorAll('tr[ng-repeat]').forEach(row => {
            const checkbox = row.querySelector('input[type="checkbox"][id^="studentsCheckBox_"]');
            if (!checkbox) return;
            row.classList.toggle('cx-row-selected', checkbox.checked);
        });
    }

    // ── Alarm logic ──────────────────────────────────────────────────────────────
    const CONTACT_ALARM_KEYWORD     = 'Contacts (Alarm)';
    const PERFORMANCE_ALARM_KEYWORD = 'Performance (Alarm)';
    const INTERNAL_SORT_VALUE       = '🚨Alarm: Contact';
    const VISIBLE_TEXT_DISPLAY      = '🚨Alarm: Contact';
    const DEFAULT_ALARM_TEXT        = 'Alarm';

    function safelyApplyAngular(element, callback) {
        const scope = angular.element(element).scope();
        if (scope && !scope.$$phase) scope.$apply(callback);
        else if (scope) callback();
    }

    function updateAlarmVisualText() {
        document.querySelectorAll('td.attendanceStatusAutomated').forEach(cell => {
            const alarmLink = cell.querySelector('a.ng-binding.ng-scope');
            const iconSpan  = alarmLink ? alarmLink.querySelector('.cxIcon.escalation-alarm-icon') : null;
            if (!alarmLink || !iconSpan) return;
            const titleText = alarmLink.getAttribute('title');
            let desiredText = DEFAULT_ALARM_TEXT;
            if (titleText && titleText.includes(CONTACT_ALARM_KEYWORD)) desiredText = VISIBLE_TEXT_DISPLAY;
            let currentTextNode = iconSpan.nextSibling;
            let actualText = currentTextNode && currentTextNode.nodeType === Node.TEXT_NODE ? currentTextNode.textContent.trim() : '';
            if (actualText === desiredText) return;
            if (currentTextNode && currentTextNode.nodeType === Node.TEXT_NODE) alarmLink.removeChild(currentTextNode);
            alarmLink.appendChild(document.createTextNode(desiredText));
        });
    }

    function modifyAlarmAngularData() {
        const tbody = document.querySelector('tbody');
        if (!tbody) return;
        safelyApplyAngular(tbody, () => {
            const scope = angular.element(tbody).scope();
            if (!scope || !Array.isArray(scope.students)) return;
            scope.students.forEach(student => {
                const currentStatus = student.attendanceStatusAutomated;
                let targetStatus = currentStatus;
                if (student.whyEscalated && typeof student.whyEscalated === 'string') {
                    if (student.whyEscalated.includes(CONTACT_ALARM_KEYWORD)) targetStatus = INTERNAL_SORT_VALUE;
                    else if (student.whyEscalated.includes(PERFORMANCE_ALARM_KEYWORD)) targetStatus = DEFAULT_ALARM_TEXT;
                    else if (currentStatus === INTERNAL_SORT_VALUE) targetStatus = DEFAULT_ALARM_TEXT;
                } else if (currentStatus === INTERNAL_SORT_VALUE) {
                    targetStatus = DEFAULT_ALARM_TEXT;
                }
                if (currentStatus !== targetStatus) student.attendanceStatusAutomated = targetStatus;
            });
        });
    }

    function runAlarmLogic() {
        if (!isMyStudentsPage()) return;
        updateAlarmVisualText();
        modifyAlarmAngularData();
    }

    // ── Count helpers ─────────────────────────────────────────────────────────────
    function getSelectedCount() {
        const emailBtn = document.getElementById('my-students-send-email');
        if (emailBtn) {
            const match = emailBtn.textContent.match(/\(\s*(\d+)\s*\)/);
            if (match) return parseInt(match[1], 10);
        }
        return document.querySelectorAll('input[type="checkbox"][id^="studentsCheckBox_"]:checked').length;
    }

    function syncButtonCounts() {
        const logsBtn      = document.getElementById('open-logs-tabs');
        const pointsBtn    = document.getElementById('open-points-tabs');
        if (!logsBtn) return;
        const count = getSelectedCount();
        logsBtn.querySelector('.primary-text').textContent      = `🪵Logs ( ${count} )`;
        pointsBtn.querySelector('.primary-text').textContent    = `🪙RCA Points ( ${count} )`;
        logsBtn.disabled      = count === 0;
        pointsBtn.disabled    = count === 0;
        syncAllRowHighlights();
    }

    let emailBtnObserver = null;
    function watchEmailButton() {
        if (emailBtnObserver) { emailBtnObserver.disconnect(); emailBtnObserver = null; }
        const emailBtn = document.getElementById('my-students-send-email');
        if (!emailBtn) return;
        emailBtnObserver = new MutationObserver(() => syncButtonCounts());
        emailBtnObserver.observe(emailBtn, { subtree: true, characterData: true, childList: true });
    }

    // ── DOM observer ─────────────────────────────────────────────────────────────
    let domDebounceTimer = null;
    const domObserver = new MutationObserver(() => {
        clearTimeout(domDebounceTimer);
        domDebounceTimer = setTimeout(() => {
            runAlarmLogic();
            injectRowButtons();
            syncButtonCounts();
            watchEmailButton();
        }, 150);
    });

    // ── Row helpers ───────────────────────────────────────────────────────────────
    function highlightRow(checkbox) {
        const row = checkbox.closest('tr');
        if (row) row.classList.toggle('cx-row-selected', checkbox.checked);
    }

    function getStudentName(checkbox) {
        const row = checkbox.closest('tr');
        if (!row) return null;
        const nameLink = row.querySelector('.sas-student-name-column a.nameWithContextMenu');
        if (!nameLink) return null;
        const text = nameLink.textContent.trim();
        if (text.includes(',')) {
            const parts = text.split(',').map(p => p.trim());
            return `${parts[1]} ${parts[0]}`;
        }
        return text;
    }

    // ── RCA Points menu ───────────────────────────────────────────────────────────
    // All 7 categories matching the RCA site.
    // Comment passed as &comment= in URL — if blank, notes field stays empty.
    const RCA_CATEGORIES = [
        'Academics',
        'Communication',
        'Effort',
        'Good Character',
        'Other',
        'Participation',
        'School Spirit'
    ];

    function openRcaMenu() {
        const existing = document.getElementById('cx-rca-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'cx-rca-overlay';

        const radioOptions = RCA_CATEGORIES.map((cat, i) => `
            <label>
                <input type="radio" name="cx-rca-cat" value="${cat}" ${i === 0 ? 'checked' : ''}>
                ${cat}
            </label>
        `).join('');

        overlay.innerHTML = `
            <div id="cx-rca-menu">
                <h3>🪙 RCA Points</h3>
                <div class="cx-rca-categories">${radioOptions}</div>
                <textarea id="cx-rca-comment" placeholder="Add a comment (optional)..."></textarea>
                <div id="cx-rca-error"></div>
                <div class="cx-rca-menu-footer">
                    <button class="cx-rca-cancel-btn" id="cx-rca-cancel">Cancel</button>
                    <button class="cx-rca-submit-btn" id="cx-rca-submit">Submit</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        document.getElementById('cx-rca-cancel').addEventListener('click', () => overlay.remove());
        document.getElementById('cx-rca-submit').addEventListener('click', () => {
            const selected = overlay.querySelector('input[name="cx-rca-cat"]:checked');
            const errorEl  = document.getElementById('cx-rca-error');
            if (!selected) { errorEl.textContent = '⚠️ Please select a category.'; return; }
            const category = selected.value;
            const comment  = document.getElementById('cx-rca-comment').value.trim();
            overlay.remove();
            openPointsForCategory(category, comment);
        });
    }

    function openPointsForCategory(category, comment) {
        const checked = document.querySelectorAll('input[type="checkbox"][id^="studentsCheckBox_"]:checked');
        let delay = 0;
        checked.forEach(checkbox => {
            setTimeout(() => {
                const name = getStudentName(checkbox);
                if (!name) return;
                let url = `https://app.rcahousepoints.com/staff/dashboard/award-points#autofill=${encodeURIComponent(name)}&category=${encodeURIComponent(category)}`;
                if (comment) url += `&comment=${encodeURIComponent(comment)}`;
                window.open(url, '_blank');
            }, delay);
            delay += 10000;
        });
    }

    // ── Button container ──────────────────────────────────────────────────────────
    function getButtonContainer() {
        return document.querySelector('.create-group-planner-event') ||
               document.querySelector('.send-bulk-create-logs') ||
               null;
    }

    // ── Init buttons ──────────────────────────────────────────────────────────────
    let buttonsInitialized = false;

    function initButtons() {
        if (!isMyStudentsPage()) return;
        if (buttonsInitialized && document.getElementById('open-logs-tabs')) return;
        const container = getButtonContainer();
        if (!container) { setTimeout(initButtons, 500); return; }

        ['open-scheduler-tabs', 'open-logs-tabs', 'open-points-tabs'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        buttonsInitialized = true;

        function makeBtn(id, label) {
            const btn = document.createElement('button');
            btn.className = 'cxBtn primary';
            btn.id = id;
            btn.style.marginLeft = '4px';
            btn.innerHTML = `<span class="primary-text">${label}</span>`;
            btn.disabled = true;
            container.appendChild(btn);
            return btn;
        }

        const logsBtn      = makeBtn('open-logs-tabs',      '🪵Logs ( 0 )');
        const pointsBtn    = makeBtn('open-points-tabs',    '🪙RCA Points ( 0 )');

        document.addEventListener('change', (e) => {
            if (e.target.id?.startsWith('studentsCheckBox_')) highlightRow(e.target);
        });

        logsBtn.addEventListener('click', () => {
            const checked = document.querySelectorAll('input[type="checkbox"][id^="studentsCheckBox_"]:checked');
            let delay = 0;
            checked.forEach(checkbox => {
                setTimeout(() => {
                    window.open(`https://www.connexus.com/log/default.aspx?idWebuser=${checkbox.value}`, '_blank');
                }, delay);
                delay += 300;
            });
        });

        pointsBtn.addEventListener('click', () => openRcaMenu());

        syncButtonCounts();

        setTimeout(() => {
            injectRowButtons();
            runAlarmLogic();
            watchEmailButton();
            const tbody = document.querySelector('tbody') || document.body;
            domObserver.observe(tbody, { childList: true, subtree: true, characterData: true, attributes: true });
        }, 1000);
    }

    // ── Hash change ───────────────────────────────────────────────────────────────
    window.addEventListener('hashchange', () => {
        updatePanelVisibility();
        if (isMyStudentsPage()) {
            buttonsInitialized = false;
            setTimeout(initButtons, 800);
        }
    });

    updatePanelVisibility();
    initButtons();

})();