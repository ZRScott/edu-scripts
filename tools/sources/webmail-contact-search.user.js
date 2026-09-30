// ==UserScript==
// @name         WebMail Contact Search
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Search Webmail contacts
// @author       Zac Scott
// @match        https://www.connexus.com/webmail*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @icon         https://www.svgrepo.com/show/366246/mail-mark-read.svg
// @updateURL    https://raw.githubusercontent.com/ZRScott/Byte_Sized/main/WebMail_Contact_Search.user.js
// @downloadURL  https://raw.githubusercontent.com/ZRScott/Byte_Sized/main/WebMail_Contact_Search.user.js
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`
        /* Header and Tab Navigation Spacing */
        #selectRecipientsHeader {
            font-size: 16px !important;
            margin-top: 0 !important;
            margin-bottom: 2px !important;
            padding-top: 0 !important;
        }

        .formRow.addRemoveRecipients {
            margin-top: -6px !important;
        }

        .addRemoveRecipients .nav-tabs {
            margin-bottom: 2px !important;
        }

        .addRemoveRecipients .nav-tabs > li > a {
            padding: 2px 8px !important;
            font-size: 12px !important;
        }

        .tab-content {
            padding-top: 0 !important;
        }

        /* Native Form Dropdowns & List Sizing */
        .formRow.addressBookList {
            margin-bottom: 2px !important;
            padding-bottom: 0 !important;
        }

        .formRow.addressBookList .formLabels,
        .formRow.addressBookList .formFields {
            margin-bottom: 2px !important;
            padding-bottom: 0 !important;
        }

        /* Native Available Recipients List Font */
        .leftSelection .availableRecipients #recipients {
            height: 100px !important;
            font-size: 14px !important;
        }

        .rightSelection {
            margin-top: 0 !important;
        }

        .rightSelection table.recipients th,
        .rightSelection table.recipients td {
            padding: 2px 4px !important;
            font-size: 12px !important;
        }

        /* Universal Directory Filter Wrapper */
        #ccrDualWrapper {
            margin-top: 6px !important;
            border: 1px solid #e1e4e8 !important;
            padding: 6px 8px !important;
            border-radius: 6px !important;
            background: #ffffff !important;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04) !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
            clear: both !important;
        }

        .ccr-search-wrapper {
            position: relative;
            margin-bottom: 4px;
        }

        /* Search Input Font Size */
        #ccrDualSearch {
            width: 100% !important;
            box-sizing: border-box !important;
            padding: 4px 8px 4px 28px !important;
            border: 1px solid #d1d5db !important;
            border-radius: 4px !important;
            font-size: 14px !important;
            outline: none !important;
        }

        #ccrDualSearch:focus {
            border-color: #d66127 !important;
            box-shadow: 0 0 0 2px rgba(214, 97, 39, 0.15) !important;
        }

        .ccr-search-icon {
            position: absolute;
            left: 8px;
            top: 50%;
            transform: translateY(-50%);
            color: #9ca3af;
            font-size: 14px;
            pointer-events: none;
        }

        /* Column Header Font */
        .ccr-col-header {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-bottom: none;
            padding: 4px 6px;
            border-radius: 4px 4px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .ccr-col-title {
            color: #334155;
            font-size: 16px !important;
            font-weight: 600;
        }

        /* Directory Options Font Size */
        .ccr-select-list {
            width: 100% !important;
            height: 105px !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 0 0 4px 4px !important;
            font-size: 14px !important;
            padding: 2px !important;
            outline: none !important;
            background: #fff !important;
        }

        .ccr-select-list option {
            padding: 2px 4px !important;
            font-size: 14px !important;
            border-radius: 2px !important;
        }

        .ccr-btn-refresh {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 11px;
            color: #475569;
            cursor: pointer;
            font-weight: 600;
        }

        .ccr-btn-refresh:hover {
            background: #e2e8f0;
            color: #1e293b;
        }
    `);

    const ccrDual = {
        interval: null,
        staffId: null,
        studentId: null,
        caretakerId: null,
        hasAutoLoaded: false,
        debounceTimer: null,

        periodically() {
            ccrDual.interval = setInterval(ccrDual.check, 750);
        },

        check() {
            if (document.getElementById("recipients") && !document.getElementById("ccrDualWrapper")) {
                ccrDual.hasAutoLoaded = false;
                ccrDual.injectUI();
            }
        },

        injectUI() {
            const nativeRecipients = document.getElementById("recipients");
            if (!nativeRecipients) return;

            const targetContainer = nativeRecipients.closest('.formRow') ? nativeRecipients.closest('.formRow').parentNode : nativeRecipients.parentNode;
            if (!targetContainer) return;

            const dualBox = document.createElement("div");
            dualBox.id = "ccrDualWrapper";
            dualBox.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <div>
                        <span style="font-weight: 700; color: #d66127; font-size: 13px;">Universal Directory Filter</span>
                        <span id="ccrDualStatus" style="font-size: 12px; font-weight: 600; color: #64748b; margin-left: 8px;"></span>
                    </div>
                    <button id="ccrRefreshBtn" class="ccr-btn-refresh" title="Force refresh directories from server">🔄 Refresh Directory Cache</button>
                </div>
                <div class="ccr-search-wrapper">
                    <span class="ccr-search-icon">🔍</span>
                    <input type="text" id="ccrDualSearch" placeholder="Search Teachers, Students, Caretakers...">
                </div>
                <div style="display: flex; gap: 8px;">
                    <div style="flex: 1;">
                        <div class="ccr-col-header">
                            <span class="ccr-col-title">Teachers & Staff</span>
                        </div>
                        <select id="ccrStaffList" class="ccr-select-list" multiple></select>
                    </div>
                    <div style="flex: 1;">
                        <div class="ccr-col-header">
                            <span class="ccr-col-title">Enrolled Students</span>
                        </div>
                        <select id="ccrStudentList" class="ccr-select-list" multiple></select>
                    </div>
                    <div style="flex: 1;">
                        <div class="ccr-col-header">
                            <span class="ccr-col-title">Enrolled Caretakers</span>
                        </div>
                        <select id="ccrCaretakerList" class="ccr-select-list" multiple></select>
                    </div>
                </div>
            `;

            targetContainer.appendChild(dualBox);

            document.getElementById("ccrRefreshBtn").onclick = function() {
                ccrDual.loadDirectories(true);
            };

            document.getElementById("ccrDualSearch").onkeyup = function() {
                clearTimeout(ccrDual.debounceTimer);
                ccrDual.debounceTimer = setTimeout(ccrDual.filterLists, 300);
            };

            const listIds = ["ccrStaffList", "ccrStudentList", "ccrCaretakerList"];

            listIds.forEach(id => {
                const element = document.getElementById(id);

                element.onchange = function() {
                    listIds.filter(otherId => otherId !== id).forEach(otherId => {
                        let otherList = document.getElementById(otherId);
                        if (otherList) otherList.selectedIndex = -1;
                    });

                    let selectedOpt = this.options[this.selectedIndex];
                    if (!selectedOpt) return;

                    let targetDirectoryId = null;
                    if (id === "ccrStaffList") targetDirectoryId = ccrDual.staffId;
                    if (id === "ccrStudentList") targetDirectoryId = ccrDual.studentId;
                    if (id === "ccrCaretakerList") targetDirectoryId = ccrDual.caretakerId;

                    ccrDual.triggerNativeSync(targetDirectoryId, selectedOpt.text, false);
                };

                element.ondblclick = function() {
                    let selectedOpt = this.options[this.selectedIndex];
                    if (!selectedOpt) return;

                    let targetDirectoryId = null;
                    if (id === "ccrStaffList") targetDirectoryId = ccrDual.staffId;
                    if (id === "ccrStudentList") targetDirectoryId = ccrDual.studentId;
                    if (id === "ccrCaretakerList") targetDirectoryId = ccrDual.caretakerId;

                    ccrDual.triggerNativeSync(targetDirectoryId, selectedOpt.text, true);
                };
            });

            if (!ccrDual.hasAutoLoaded) {
                ccrDual.hasAutoLoaded = true;
                ccrDual.initData();
            }
        },

        initData() {
            const cachedStaff = GM_getValue("ccrStaffListHtml", null);
            const cachedStudent = GM_getValue("ccrStudentListHtml", null);
            const cachedCaretaker = GM_getValue("ccrCaretakerListHtml", null);

            // Populate mapping directory IDs
            const selector = document.getElementById("addressBookSelector");
            if (selector) {
                for (let i = 0; i < selector.options.length; i++) {
                    let txt = selector.options[i].text;
                    if (txt === "Pennwood - Teachers, Administration, and Staff") ccrDual.staffId = selector.options[i].value;
                    if (txt === "Pennwood - Enrolled Students") ccrDual.studentId = selector.options[i].value;
                    if (txt === "Pennwood - Enrolled Caretakers") ccrDual.caretakerId = selector.options[i].value;
                }
            }

            // If storage exists, load instantly
            if (cachedStaff && cachedStudent && cachedCaretaker) {
                document.getElementById("ccrStaffList").innerHTML = cachedStaff;
                document.getElementById("ccrStudentList").innerHTML = cachedStudent;
                document.getElementById("ccrCaretakerList").innerHTML = cachedCaretaker;

                const status = document.getElementById("ccrDualStatus");
                status.innerText = "Loaded from storage";
                status.style.color = "#10b981";
                setTimeout(() => { if (status) status.innerText = ""; }, 2500);
            } else {
                // First run: Fetch from server
                ccrDual.loadDirectories(false);
            }
        },

        async loadDirectories(isManualRefresh = false) {
            const selector = document.getElementById("addressBookSelector");
            const nativeRecipients = document.getElementById("recipients");
            const status = document.getElementById("ccrDualStatus");
            const searchBox = document.getElementById("ccrDualSearch");
            const refreshBtn = document.getElementById("ccrRefreshBtn");

            if (!selector || !nativeRecipients) return;

            refreshBtn.disabled = true;
            searchBox.disabled = true;
            const initialVal = selector.value;

            for (let i = 0; i < selector.options.length; i++) {
                let txt = selector.options[i].text;
                if (txt === "Pennwood - Teachers, Administration, and Staff") ccrDual.staffId = selector.options[i].value;
                if (txt === "Pennwood - Enrolled Students") ccrDual.studentId = selector.options[i].value;
                if (txt === "Pennwood - Enrolled Caretakers") ccrDual.caretakerId = selector.options[i].value;
            }

            const fetchList = async (listId, storageKey, selectVal, labelName) => {
                status.innerText = `Caching ${labelName}...`;
                status.style.color = "#64748b";
                selector.value = selectVal;
                selector.dispatchEvent(new Event('change', { bubbles: true }));
                await new Promise(r => setTimeout(r, 1800));

                let html = "";
                for(let opt of nativeRecipients.options) {
                    html += `<option value="${opt.value}">${opt.text}</option>`;
                }
                document.getElementById(listId).innerHTML = html;
                GM_setValue(storageKey, html);
            };

            if (ccrDual.staffId) await fetchList("ccrStaffList", "ccrStaffListHtml", ccrDual.staffId, "Staff");
            if (ccrDual.studentId) await fetchList("ccrStudentList", "ccrStudentListHtml", ccrDual.studentId, "Students");
            if (ccrDual.caretakerId) await fetchList("ccrCaretakerList", "ccrCaretakerListHtml", ccrDual.caretakerId, "Caretakers");

            selector.value = initialVal;
            selector.dispatchEvent(new Event('change', { bubbles: true }));

            status.innerText = "Cache updated & ready!";
            status.style.color = "#10b981";
            searchBox.disabled = false;
            refreshBtn.disabled = false;
            searchBox.focus();

            setTimeout(() => {
                if (document.getElementById("ccrDualStatus")) {
                    document.getElementById("ccrDualStatus").innerText = "";
                }
            }, 3000);
        },

        triggerNativeSync(targetDirectoryId, targetContactName, autoAddTo = false) {
            if (!targetDirectoryId || !targetContactName) return;

            const selector = document.getElementById("addressBookSelector");
            const nativeRecipients = document.getElementById("recipients");

            if (selector.value !== targetDirectoryId) {
                selector.value = targetDirectoryId;
                selector.dispatchEvent(new Event('change', { bubbles: true }));
            }

            let attempts = 0;
            let syncInterval = setInterval(() => {
                let opts = Array.from(nativeRecipients.options);
                let contactFound = opts.find(o => o.text === targetContactName);

                if (contactFound) {
                    nativeRecipients.value = contactFound.value;
                    nativeRecipients.dispatchEvent(new Event('change', { bubbles: true }));

                    if (autoAddTo) {
                        const toButton = document.getElementById("selectToButton");
                        if (toButton) {
                            toButton.click();
                            if (window.angular) {
                                window.angular.element(toButton).triggerHandler('click');
                            }
                        }
                    }

                    clearInterval(syncInterval);
                }

                attempts++;
                if (attempts > 40) clearInterval(syncInterval);
            }, 100);
        },

        filterLists() {
            let filterText = document.getElementById("ccrDualSearch").value.toLowerCase();

            ["ccrStaffList", "ccrStudentList", "ccrCaretakerList"].forEach(listId => {
                let list = document.getElementById(listId);
                if (!list) return;

                list.style.display = 'none';

                let options = list.options;
                for (let i = 0; i < options.length; i++) {
                    let name = options[i].innerText.toLowerCase();
                    let isMatch = name.indexOf(filterText) !== -1;

                    options[i].hidden = !isMatch;
                    options[i].style.display = isMatch ? '' : 'none';
                }

                list.style.display = '';
            });
        }
    };

    ccrDual.periodically();
})();
