// ==UserScript==
// @name        Profile Info on WM & Logs
// @namespace    http://tampermonkey.net/
// @version      6.2
// @description  Displays student nickname, image, Special Pop tags, and RCA House Points (page scrape).
// @author       Zac Scott
// @icon         https://www.svgrepo.com/show/475624/id-card.svg
// @match        https://www.connexus.com/webmail*
// @match        https://www.connexus.com/log*
// @connect      connexus.com
// @connect      app.rcahousepoints.com
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function() {
    'use strict';

    const PROFILE_INFO_CONTAINER_ID = 'tampermonkey-profile-info-container';
    const NICKNAME_DISPLAY_ID = 'tampermonkey-nickname-display';
    const SPECIAL_POPS_DISPLAY_ID = 'tampermonkey-special-pops-display';
    const HOUSE_POINTS_DISPLAY_ID = 'tampermonkey-house-points-display';
    const IMAGE_DISPLAY_ID = 'tampermonkey-image-display';
    const COLLAPSE_BUTTON_ID = 'tampermonkey-collapse-button';

    let currentStudentId = null;
    let isCollapsed = false;

    const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
    const POINTS_CACHE_DURATION_MS = 2 * 60 * 1000;
    const SCRIPT_VERSION_TAG = '_v6.2_pageScrape';

    // --- UI CREATION ---

    function getOrCreateProfileInfoContainer(parentContainer) {
        let container = document.getElementById(PROFILE_INFO_CONTAINER_ID);
        if (container && container.parentElement !== parentContainer) {
            parentContainer.appendChild(container);
            return container;
        }
        if (container) return container;

        container = document.createElement('div');
        container.id = PROFILE_INFO_CONTAINER_ID;
        container.style.position = 'absolute';
        container.style.top = '130px';
        container.style.right = '50px';
        container.style.zIndex = '99999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.padding = '5px';
        container.style.minWidth = '200px';
        container.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
        container.style.borderRadius = '8px';
        container.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
        container.style.fontFamily = 'Arial, sans-serif';
        container.style.pointerEvents = 'none';
        parentContainer.appendChild(container);
        return container;
    }

    function createCollapseButton(profileInfoContainer) {
        let button = document.getElementById(COLLAPSE_BUTTON_ID);
        if (button) return button;
        button = document.createElement('button');
        button.id = COLLAPSE_BUTTON_ID;
        button.innerHTML = '▲';
        button.style.position = 'absolute';
        button.style.top = '5px';
        button.style.right = '5px';
        button.style.width = '20px';
        button.style.height = '20px';
        button.style.fontSize = '12px';
        button.style.border = 'none';
        button.style.backgroundColor = '#722362';
        button.style.color = 'white';
        button.style.borderRadius = '4px';
        button.style.cursor = 'pointer';
        button.style.pointerEvents = 'auto';
        button.style.zIndex = '100000';
        button.addEventListener('click', toggleCollapse);
        profileInfoContainer.appendChild(button);
        return button;
    }

    function toggleCollapse() {
        isCollapsed = !isCollapsed;
        const imageDiv = document.getElementById(IMAGE_DISPLAY_ID);
        const button = document.getElementById(COLLAPSE_BUTTON_ID);
        if (isCollapsed) {
            if (imageDiv) imageDiv.style.display = 'none';
            button.innerHTML = '▼';
        } else {
            if (imageDiv) imageDiv.style.display = 'block';
            button.innerHTML = '▲';
        }
    }

    function displayNickname(nickname, studentId, profileInfoContainer) {
        if (!profileInfoContainer) return;
        let nicknameDiv = document.getElementById(NICKNAME_DISPLAY_ID);
        const mainText = nickname ? nickname : "";
        const idPart = studentId ? ` (ID: ${studentId})` : '';
        const fullText = mainText ? mainText + idPart : "";
        if (!fullText) { if (nicknameDiv) nicknameDiv.remove(); return; }
        if (!nicknameDiv) {
            nicknameDiv = document.createElement('div');
            nicknameDiv.id = NICKNAME_DISPLAY_ID;
            nicknameDiv.style.fontSize = '10.5px';
            nicknameDiv.style.fontWeight = 'bold';
            nicknameDiv.style.color = '#0066cc';
            nicknameDiv.style.textAlign = 'center';
            nicknameDiv.style.marginTop = '4px';
            nicknameDiv.style.textShadow = '0px 0px 2px white';
            nicknameDiv.style.paddingRight = '30px';
            nicknameDiv.style.paddingLeft = '5px';
            nicknameDiv.style.pointerEvents = 'auto';
            nicknameDiv.style.userSelect = 'text';
            nicknameDiv.style.cursor = 'text';
            profileInfoContainer.appendChild(nicknameDiv);
        }
        nicknameDiv.textContent = fullText;
        createCollapseButton(profileInfoContainer);
    }

    function displaySpecialPops(tags, profileInfoContainer) {
        if (!profileInfoContainer) return;
        let popsDiv = document.getElementById(SPECIAL_POPS_DISPLAY_ID);
        if (!tags || tags.length === 0) { if (popsDiv) popsDiv.remove(); return; }
        if (!popsDiv) {
            popsDiv = document.createElement('div');
            popsDiv.id = SPECIAL_POPS_DISPLAY_ID;
            popsDiv.style.fontSize = '11px';
            popsDiv.style.fontWeight = 'bold';
            popsDiv.style.color = '#D8000C';
            popsDiv.style.textAlign = 'center';
            popsDiv.style.marginTop = '2px';
            popsDiv.style.marginBottom = '2px';
            popsDiv.style.pointerEvents = 'auto';
            const nicknameDiv = document.getElementById(NICKNAME_DISPLAY_ID);
            if (nicknameDiv && nicknameDiv.nextSibling) {
                profileInfoContainer.insertBefore(popsDiv, nicknameDiv.nextSibling);
            } else {
                profileInfoContainer.appendChild(popsDiv);
            }
        }
        popsDiv.textContent = tags.join(' | ');
    }

    function displayHousePoints(pointsString, profileInfoContainer) {
        if (!profileInfoContainer) return;
        let pointsDiv = document.getElementById(HOUSE_POINTS_DISPLAY_ID);
        if (!pointsString) { if (pointsDiv) pointsDiv.remove(); return; }
        if (!pointsDiv) {
            pointsDiv = document.createElement('div');
            pointsDiv.id = HOUSE_POINTS_DISPLAY_ID;
            pointsDiv.style.fontSize = '12px';
            pointsDiv.style.fontWeight = 'bold';
            pointsDiv.style.color = '#228B22';
            pointsDiv.style.textAlign = 'center';
            pointsDiv.style.marginBottom = '4px';
            pointsDiv.style.pointerEvents = 'auto';
            const popsDiv = document.getElementById(SPECIAL_POPS_DISPLAY_ID);
            const nicknameDiv = document.getElementById(NICKNAME_DISPLAY_ID);
            let referenceNode = popsDiv || nicknameDiv;
            if (referenceNode && referenceNode.nextSibling) {
                profileInfoContainer.insertBefore(pointsDiv, referenceNode.nextSibling);
            } else {
                profileInfoContainer.appendChild(pointsDiv);
            }
        }
        pointsDiv.textContent = `House Points: ${pointsString}`;
    }

    function displayImageLink(imageUrl, filename, studentId, profileInfoContainer) {
        if (!profileInfoContainer) return;
        let imageDiv = document.getElementById(IMAGE_DISPLAY_ID);
        if (!imageUrl) { if (imageDiv) imageDiv.remove(); return; }
        if (!imageDiv) {
            imageDiv = document.createElement('div');
            imageDiv.id = IMAGE_DISPLAY_ID;
            imageDiv.style.flexShrink = '0';
            imageDiv.style.pointerEvents = 'auto';
            profileInfoContainer.appendChild(imageDiv);
        }
        imageDiv.innerHTML = '';
        const imgElement = document.createElement('img');
        imgElement.src = imageUrl;
        imgElement.alt = filename || 'Student Image';
        imgElement.style.width = 'auto';
        imgElement.style.height = '225px';
        imgElement.style.objectFit = 'contain';
        imgElement.style.borderRadius = '8px';
        imgElement.style.border = '3px solid #722362';
        imgElement.style.display = 'block';
        imgElement.style.margin = 'auto';
        imgElement.style.marginTop = '5px';
        imgElement.style.backgroundColor = 'white';
        imageDiv.appendChild(imgElement);
        if (isCollapsed) imageDiv.style.display = 'none';
    }

    function extractNameFromSpan(text) {
        if (!text) return null;
        let clean = text.replace(/^\s*Log\s+for\s+/i, '');
        clean = clean.replace(/\s*\(\s*ID\s*[\d]+\s*\).*$/i, '');
        return clean.trim();
    }

    // --- DATA FETCHING ---

    // 1. Fetch RCA House Points by scraping the reports page with a search param
    async function fetchHousePoints(studentFullName, studentId, profileInfoContainer) {
        if (!studentFullName) return;

        console.log(`TM Script: Searching House Points (page scrape) for "${studentFullName}"...`);

        const cacheKey = `rca_points_${studentId}${SCRIPT_VERSION_TAG}`;
        const cachedData = await GM_getValue(cacheKey, null);
        const now = Date.now();

        if (cachedData && (now - cachedData.timestamp < POINTS_CACHE_DURATION_MS)) {
            displayHousePoints(cachedData.points, profileInfoContainer);
            return;
        }

        // Build URL: the page filters results server-side when ?search= is in the URL
        const searchUrl = `https://app.rcahousepoints.com/staff/dashboard/reports?search=${encodeURIComponent(studentFullName)}`;

        GM_xmlhttpRequest({
            method: 'GET',
            url: searchUrl,
            timeout: 15000,
            onload: function(response) {
                if (studentId !== currentStudentId) return;

                if (response.status < 200 || response.status >= 300) {
                    console.log("TM Script: RCA page error - Status " + response.status);
                    return;
                }

                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');

                    // Each student row is a div[role="button"] containing the name and points.
                    // Find the row whose text contains the student's full name.
                    const rows = doc.querySelectorAll('div[role="button"]');
                    let foundPoints = null;

                    for (const row of rows) {
                        // Check if this row contains the student's name
                        const rowText = row.textContent || '';
                        if (rowText.toLowerCase().includes(studentFullName.toLowerCase())) {
                            // Points are in the last div with class "mr-2 min-w-[50px]"
                            const pointsEl = row.querySelector('div.mr-2');
                            if (pointsEl) {
                                const match = pointsEl.textContent.trim().match(/(\d+)\s*pts/i);
                                if (match) {
                                    foundPoints = match[1] + ' pts';
                                } else {
                                    // Fallback: use raw text if it looks like a number
                                    const raw = pointsEl.textContent.trim();
                                    if (raw) foundPoints = raw;
                                }
                            }
                            break;
                        }
                    }

                    if (foundPoints !== null) {
                        console.log(`TM Script: Points found -> ${foundPoints}`);
                        GM_setValue(cacheKey, { points: foundPoints, timestamp: Date.now() });
                        displayHousePoints(foundPoints, profileInfoContainer);
                    } else {
                        console.log("TM Script: Student not found in scraped page results.");
                    }

                } catch (e) {
                    console.error("TM Script: Error parsing RCA page:", e);
                }
            }
        });
    }

    // 2. Fetch Connexus Data
    async function fetchStudentData(studentId, profileInfoContainer) {
        if (!studentId) return;
        const cacheKey = `connexus_data_${studentId}${SCRIPT_VERSION_TAG}`;
        const cachedData = await GM_getValue(cacheKey, null);
        const now = Date.now();

        if (cachedData && (now - cachedData.timestamp < CACHE_DURATION_MS)) {
            displayNickname(cachedData.nickname, studentId, profileInfoContainer);
            displaySpecialPops(cachedData.specialPops, profileInfoContainer);
            if (cachedData.realName) fetchHousePoints(cachedData.realName, studentId, profileInfoContainer);
            return;
        }

        const overviewUrl = `https://www.connexus.com/log/default.aspx?idWebuser=${studentId}&sendTo=%2fwebuser%2foverview.aspx%3fidWebuser%3d${studentId}`;

        GM_xmlhttpRequest({
            method: 'GET',
            url: overviewUrl,
            timeout: 15000,
            onload: function(response) {
                if (studentId !== currentStudentId) return;
                if (response.status >= 200 && response.status < 300) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');

                        const nicknameElement = doc.querySelector('a#nickNameLink');
                        let finalNickname = null;
                        if (nicknameElement) {
                            const rawTitle = (nicknameElement.getAttribute('title') || '').trim();
                            let processedText = rawTitle.replace(/^\s*Nickname:\s*/i, '').trim();
                            if (processedText) finalNickname = processedText;
                        }

                        let realFullName = null;
                        const titleSpan = doc.getElementById('pageTitleHeaderTextSpan');
                        if (titleSpan) realFullName = extractNameFromSpan(titleSpan.textContent);

                        let specialPops = [];
                        if (doc.querySelector('.view-iep-504-icon')) specialPops.push('504');
                        if (doc.querySelector('.view-iep-icon')) specialPops.push('IEP');
                        if (doc.querySelector('.view-iep-english-language-icon')) specialPops.push('EL');
                        if (doc.querySelector('.view-iep-special-populations-icon')) specialPops.push('Spec Pop');

                        GM_setValue(cacheKey, {
                            nickname: finalNickname,
                            realName: realFullName,
                            specialPops: specialPops,
                            timestamp: Date.now()
                        });

                        displayNickname(finalNickname, studentId, profileInfoContainer);
                        displaySpecialPops(specialPops, profileInfoContainer);
                        if (realFullName) fetchHousePoints(realFullName, studentId, profileInfoContainer);

                    } catch (parseError) { console.error(parseError); }
                }
            }
        });
    }

    // 3. Fetch Image
    async function fetchImageLink(studentId, profileInfoContainer) {
        if (!studentId) return;
        const cacheKey = `connexus_image_${studentId}${SCRIPT_VERSION_TAG}`;
        const cachedData = await GM_getValue(cacheKey, null);
        const now = Date.now();
        if (cachedData && (now - cachedData.timestamp < CACHE_DURATION_MS)) {
            displayImageLink(cachedData.imageUrl, cachedData.filename, studentId, profileInfoContainer);
            return;
        }
        const imageSearchUrl = `https://www.connexus.com/dataview/16631?idWebuser=${studentId}`;
        GM_xmlhttpRequest({
            method: 'GET',
            url: imageSearchUrl,
            timeout: 15000,
            onload: function(response) {
                if (studentId !== currentStudentId) return;
                if (response.status >= 200 && response.status < 300) {
                    try {
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(response.responseText, 'text/html');
                        let imageUrl = null;
                        let filename = null;
                        let downloadLink = doc.querySelector('a.downloadFile[data-filename*=".JPG"], a.downloadFile[data-filename*=".jpg"], a.downloadFile[data-filename*=".PNG"], a.downloadFile[data-filename*=".png"], a.downloadFile[data-filename*=".JPEG"], a.downloadFile[data-filename*=".jpeg"]');
                        if (!downloadLink) {
                            downloadLink = doc.querySelector('li.file-uploaded .downloadFile[data-filename*=".jpg"], li.file-uploaded .downloadFile[data-filename*=".JPG"], li.file-uploaded .downloadFile[data-filename*=".png"], li.file-uploaded .downloadFile[data-filename*=".PNG"], li.file-uploaded .downloadFile[data-filename*=".jpeg"], li.file-uploaded .downloadFile[data-filename*=".JPEG"]');
                        }
                        if (downloadLink) {
                            let href = downloadLink.getAttribute('href');
                            imageUrl = href.startsWith('/') ? 'https://www.connexus.com' + href : href;
                            filename = downloadLink.getAttribute('data-filename') || downloadLink.textContent;
                            if (filename.includes('/')) filename = filename.split('/').pop();
                        }
                        GM_setValue(cacheKey, { imageUrl: imageUrl, filename: filename, timestamp: Date.now() });
                        displayImageLink(imageUrl, filename, studentId, profileInfoContainer);
                    } catch (parseError) { console.error(parseError); }
                }
            }
        });
    }

    // --- MAIN LOOP ---

    function checkForStudentId() {
        const parentContainer = document.querySelector('.headerWrapper');
        if (!parentContainer) return;

        let detectedId = null;
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('idWebuser')) detectedId = urlParams.get('idWebuser');

        if (!detectedId) {
            const studentLinkElement = document.querySelector('.contextMenu > .ng-scope:nth-child(1) a[href*="idWebuser="]');
            if (studentLinkElement) {
                try {
                    const url = new URL(studentLinkElement.href);
                    detectedId = url.searchParams.get('idWebuser');
                } catch(e) {}
            }
        }

        if (detectedId) {
            if (detectedId !== currentStudentId) {
                currentStudentId = detectedId;
                const profileInfoContainer = getOrCreateProfileInfoContainer(parentContainer);
                fetchStudentData(detectedId, profileInfoContainer);
                fetchImageLink(detectedId, profileInfoContainer);
            }
        } else {
            clearAllDisplays();
        }
    }

    function clearAllDisplays() {
        const container = document.getElementById(PROFILE_INFO_CONTAINER_ID);
        if (container) container.remove();
        currentStudentId = null;
        isCollapsed = false;
    }

    const observer = new MutationObserver(() => checkForStudentId());
    setTimeout(() => {
        observer.observe(document.body, { childList: true, subtree: true });
        checkForStudentId();
    }, 1500);
})();