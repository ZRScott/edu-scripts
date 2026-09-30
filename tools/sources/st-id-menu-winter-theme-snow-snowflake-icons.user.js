// ==UserScript==
// @name         ST ID Menu (Winter Theme + Snow + Snowflake Icons)
// @namespace    http://tampermonkey.net/
// @version      4.3
// @description  Winter-themed floating student menu with snow, tilt, open-all, keyboard shortcut, loading state; tiny ❄ icons injected next to each 7-digit ID that open the menu when clicked. Includes Start-Up Tasks link; avoids conflicts with dblclick scripts by not using dblclick at all.
// @author       Zac Scott
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- STATE ---
    let lastStudentId = null;
    let lastPosX = 0;
    let lastPosY = 0;
    let lastMenuShowTime = 0;

    // --- SNOW STATE ---
    let snowCanvas = null;
    let snowCtx = null;
    let snowflakes = [];
    let isSnowing = false;
    let snowAnimationFrameId = null;

    // --- SNOWFLAKE ICON CSS ---
    const style = document.createElement('style');
    style.textContent = `
        @keyframes winterShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }

        .st-id-snowflake {
            display: inline-block;
            margin-left: 4px;
            cursor: pointer;
            font-size: 12px;
            vertical-align: middle;
            color: #e6f3ff;
            text-shadow:
                1px 1px 2px rgba(0,102,204,0.9),
                -1px -1px 2px rgba(0,102,204,0.9);
            transition: transform 0.15s ease, text-shadow 0.15s ease;
        }

        .st-id-snowflake:hover {
            transform: translateY(-1px) scale(1.2);
            text-shadow:
                0 0 4px rgba(255,255,255,1),
                0 0 8px rgba(150,200,255,1);
        }
    `;
    document.head.appendChild(style);

    // Initialize snow canvas (created on first use)
    function initSnowCanvas() {
        if (snowCanvas) return;

        snowCanvas = document.createElement('canvas');
        snowCanvas.style.position = 'fixed';
        snowCanvas.style.top = '0';
        snowCanvas.style.left = '0';
        snowCanvas.style.width = '100%';
        snowCanvas.style.height = '100%';
        snowCanvas.style.pointerEvents = 'none'; // don't block clicks
        snowCanvas.style.zIndex = 999998; // just behind the menu (999999)
        snowCanvas.style.display = 'none';
        document.body.appendChild(snowCanvas);

        snowCtx = snowCanvas.getContext('2d');
        resizeSnowCanvas();

        window.addEventListener('resize', resizeSnowCanvas);

        // Create initial snowflakes
        const flakeCount = 120;
        for (let i = 0; i < flakeCount; i++) {
            snowflakes.push(createSnowflake());
        }
    }

    function resizeSnowCanvas() {
        if (!snowCanvas) return;
        snowCanvas.width = window.innerWidth;
        snowCanvas.height = window.innerHeight;
    }

    function createSnowflake() {
        return {
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            r: 1.5 + Math.random() * 3.5,
            speedY: 0.5 + Math.random() * 1.5,
            speedX: -0.5 + Math.random() * 1.0
        };
    }

    function startSnow() {
        initSnowCanvas();
        if (isSnowing) return;
        isSnowing = true;
        snowCanvas.style.display = 'block';
        animateSnow();
    }

    function stopSnow() {
        isSnowing = false;
        if (snowCanvas) {
            snowCanvas.style.display = 'none';
        }
        if (snowAnimationFrameId) {
            cancelAnimationFrame(snowAnimationFrameId);
            snowAnimationFrameId = null;
        }
    }

    function animateSnow() {
        if (!isSnowing || !snowCtx || !snowCanvas) return;

        const width = snowCanvas.width;
        const height = snowCanvas.height;

        snowCtx.clearRect(0, 0, width, height);

        snowCtx.fillStyle = 'rgba(255,255,255,0.85)';
        snowCtx.beginPath();
        for (let flake of snowflakes) {
            snowCtx.moveTo(flake.x, flake.y);
            snowCtx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);

            flake.y += flake.speedY;
            flake.x += flake.speedX;

            if (flake.y > height + flake.r) {
                flake.y = -flake.r;
                flake.x = Math.random() * width;
            }
            if (flake.x > width + flake.r) {
                flake.x = -flake.r;
            } else if (flake.x < -flake.r) {
                flake.x = width + flake.r;
            }
        }
        snowCtx.fill();

        snowAnimationFrameId = requestAnimationFrame(animateSnow);
    }

    // --- MENU CONTAINER ---
    const menuContainer = document.createElement('div');
    // Absolute so it scrolls with the page (anchored to document)
    menuContainer.style.position = 'absolute';

    // ❄️ Winter Gradient Background
    menuContainer.style.background = "linear-gradient(135deg, rgba(0,102,204,0.55), rgba(255,255,255,0.35))";
    menuContainer.style.backgroundSize = "200% 200%";
    menuContainer.style.animation = "winterShift 18s ease infinite";

    // Frosted glass effect
    menuContainer.style.backdropFilter = "blur(10px)";
    menuContainer.style.backgroundColor = "rgba(255,255,255,0.25)";

    // Frosty blue glow border
    menuContainer.style.border = "2px solid rgba(150,200,255,0.9)";
    menuContainer.style.boxShadow = "0 0 20px rgba(120,180,255,0.8), 0 0 40px rgba(100,150,255,0.4)";

    menuContainer.style.padding = "20px";
    menuContainer.style.display = "none";
    menuContainer.style.zIndex = 999999;
    menuContainer.style.maxWidth = "380px";
    menuContainer.style.borderRadius = "18px";
    menuContainer.style.fontFamily = "Arial, sans-serif";
    menuContainer.style.fontSize = "18px"; // base

    // ❄️ White text with icy blue outline
    const winterTextShadow = `
        2px 2px 4px rgba(0,102,204,0.9),
        -2px -2px 4px rgba(0,102,204,0.9),
        2px -2px 4px rgba(0,102,204,0.9),
        -2px 2px 4px rgba(0,102,204,0.9)
    `;
    menuContainer.style.color = "#FFFFFF";
    menuContainer.style.textShadow = winterTextShadow;

    // Fade + slide animation
    menuContainer.style.opacity = "0";
    menuContainer.style.transform = "translateY(-12px)";
    menuContainer.style.transition = "opacity 0.3s ease-out, transform 0.3s ease-out";

    document.body.appendChild(menuContainer);

    // --- MENU ITEMS ---
    const menuItems = [
        { text: 'Grade Book', url: 'https://www.connexus.com/gradeBook/default.aspx?idWebuser=%%STUDENT_ID%%' },
        { text: 'Log Search', url: 'https://www.connexus.com/log/default.aspx?idWebuser=%%STUDENT_ID%%' },
        { text: 'Transcript', url: 'https://www.connexus.com/gradeBook/progressReport/transcript/default.aspx?idWebuser=%%STUDENT_ID%%&type=highSchool' },
        { text: 'Assessments Completed', url: 'https://www.connexus.com/assessments/results/listTaken.aspx?idWebuser=%%STUDENT_ID%%' },
        { text: 'Start-Up Tasks', url: 'https://www.connexus.com/dataview/22?idWebuser=%%STUDENT_ID%%' }
    ];

    // --- UTIL: POSITIONING (PAGE-ANCHORED) ---
    function applyPosition(x, y) {
        lastPosX = x;
        lastPosY = y;

        const menuWidth = 380;
        const viewportLeft = window.scrollX;
        const viewportRight = window.scrollX + window.innerWidth;
        const viewportTop = window.scrollY;

        let posX = x;
        let posY = y;

        if (posX + menuWidth > viewportRight) {
            posX = viewportRight - menuWidth - 10;
        }
        if (posX < viewportLeft + 10) {
            posX = viewportLeft + 10;
        }
        if (posY < viewportTop + 10) {
            posY = viewportTop + 10;
        }

        menuContainer.style.left = posX + "px";
        menuContainer.style.top = posY + "px";
    }

    // --- FETCH STUDENT INFO ---
    function fetchStudentInfo(studentId) {
        return new Promise(resolve => {
            const iframe = document.createElement("iframe");
            iframe.style.display = "none";
            iframe.src = `https://www.connexus.com/dataview/789?idWebuser=${studentId}`;
            document.body.appendChild(iframe);

            const start = Date.now();
            const maxMs = 10000; // 10s safety timeout

            const interval = setInterval(() => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    const lastLessonSpan = doc.getElementById("EF_LastLessonComplete");
                    const lastContactSpan = doc.getElementById("EF_StudentLastSynchronousContact");

                    // Optional extra fields if present (update IDs as needed)
                    const advisorSpan = doc.getElementById("EF_StudentAdvisor");
                    const statusSpan = doc.getElementById("EF_StudentStatus");
                    const gradeSpan = doc.getElementById("EF_StudentGradeLevel");

                    const lastLesson = lastLessonSpan?.textContent.trim();
                    const lastContact = lastContactSpan?.textContent.trim();

                    if ((lastLesson && lastContact) || Date.now() - start > maxMs) {
                        clearInterval(interval);
                        const info = {
                            lastLessonDate: lastLesson || "N/A",
                            lastContact: lastContact || "N/A",
                            advisor: advisorSpan?.textContent.trim() || null,
                            status: statusSpan?.textContent.trim() || null,
                            grade: gradeSpan?.textContent.trim() || null
                        };
                        document.body.removeChild(iframe);
                        resolve(info);
                    }
                } catch {
                    if (Date.now() - start > maxMs) {
                        clearInterval(interval);
                        document.body.removeChild(iframe);
                        resolve({
                            lastLessonDate: "Unavailable",
                            lastContact: "Unavailable",
                            advisor: null,
                            status: null,
                            grade: null
                        });
                    }
                }
            }, 200);
        });
    }

    // --- RENDER CONTENT ---
    function renderMenuContent(studentId, info, isLoading) {
        let infoHtml;

        if (isLoading) {
            infoHtml = `
                <div style="
                    color:white;
                    font-size:18px;
                    text-shadow:${winterTextShadow};
                    margin-bottom:6px;
                ">
                    Loading student info...
                </div>
            `;
        } else if (!info) {
            infoHtml = `
                <div style="
                    color:white;
                    font-size:18px;
                    text-shadow:${winterTextShadow};
                    margin-bottom:6px;
                ">
                    Student info unavailable.
                </div>
            `;
        } else {
            let extraHtml = "";
            if (info.grade || info.status || info.advisor) {
                extraHtml += `<div style="margin-top:6px; font-size:16px;">`;
                if (info.grade) {
                    extraHtml += `<div><strong>Grade:</strong> ${info.grade}</div>`;
                }
                if (info.status) {
                    extraHtml += `<div><strong>Status:</strong> ${info.status}</div>`;
                }
                if (info.advisor) {
                    extraHtml += `<div><strong>Advisor:</strong> ${info.advisor}</div>`;
                }
                extraHtml += `</div>`;
            }

            infoHtml = `
                <div style="
                    color:white;
                    font-size:18px; /* ~14pt */
                    text-shadow:${winterTextShadow};
                ">
                    <strong>Last Lesson:</strong> ${info.lastLessonDate}
                </div>

                <div style="
                    color:white;
                    font-size:18px; /* ~14pt */
                    text-shadow:${winterTextShadow};
                    margin-bottom:6px;
                ">
                    <strong>Last Contact:</strong> ${info.lastContact}
                </div>
                ${extraHtml}
            `;
        }

        const headerAndInfo = `
            <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                margin-bottom:10px;
            ">
                <div style="
                    font-weight:bold;
                    font-size:22px;
                    color:white;
                    text-shadow:${winterTextShadow};
                    padding-right:8px;
                ">
                    ❄️ Student Overview ❄️
                </div>
                <div style="display:flex; gap:6px;">
                    <button id="stMenuOpenAllBtn" title="Open all links"
                        style="
                            cursor:pointer;
                            border:none;
                            background:rgba(255,255,255,0.18);
                            border-radius:6px;
                            padding:2px 6px;
                            color:white;
                            text-shadow:${winterTextShadow};
                            font-size:14px;
                        ">
                        ↗
                    </button>
                    <button id="stMenuCloseBtn" title="Close"
                        style="
                            cursor:pointer;
                            border:none;
                            background:rgba(255,255,255,0.18);
                            border-radius:6px;
                            padding:2px 8px;
                            color:white;
                            text-shadow:${winterTextShadow};
                            font-size:14px;
                            font-weight:bold;
                        ">
                        ✕
                    </button>
                </div>
            </div>

            ${infoHtml}

            <hr style="border:0; border-top:2px solid rgba(200,220,255,0.7); margin:12px 0%;">
        `;

        let linksHTML = "<ul style='padding-left:0; list-style:none; margin:0;'>";
        menuItems.forEach(item => {
            const url = item.url.replace(/%%STUDENT_ID%%/g, studentId);
            linksHTML += `
                <li style="margin-bottom:8px; padding:2px 0; border-radius:8px; transition:background 0.15s;">
                    <a href="${url}" target="_blank"
                        style="
                            display:block;
                            color:white;
                            font-weight:bold;
                            text-decoration:none;
                            text-shadow:${winterTextShadow};
                            padding:2px 4px;
                            border-radius:8px;
                        "
                        onmouseover="
                            this.style.textDecoration='underline';
                            this.parentNode.style.background='rgba(255,255,255,0.12)';
                        "
                        onmouseout="
                            this.style.textDecoration='none';
                            this.parentNode.style.background='transparent';
                        ">
                        ${item.text}
                    </a>
                </li>`;
        });
        linksHTML += "</ul>";

        menuContainer.innerHTML = headerAndInfo + linksHTML;

        attachHeaderHandlers(studentId);
    }

    // --- HEADER BUTTON HANDLERS ---
    function attachHeaderHandlers(studentId) {
        const closeBtn = document.getElementById('stMenuCloseBtn');
        const openAllBtn = document.getElementById('stMenuOpenAllBtn');

        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                menuContainer.style.display = "none";
                menuContainer.style.opacity = "0";
                stopSnow();
            };
        }

        if (openAllBtn) {
            openAllBtn.onclick = (e) => {
                e.stopPropagation();
                menuItems.forEach(item => {
                    const url = item.url.replace(/%%STUDENT_ID%%/g, studentId);
                    window.open(url, "_blank");
                });
            };
        }
    }

    // --- SHOW MENU ---
    async function showMenu(studentId, x, y) {
        lastStudentId = studentId;

        applyPosition(x, y);
        menuContainer.style.display = "block";
        menuContainer.style.transform = "translateY(-12px) rotateX(0deg) rotateY(0deg)";
        menuContainer.style.opacity = "0";

        // Start snow when the menu opens
        startSnow();

        // Initial "loading" content
        renderMenuContent(studentId, null, true);

        requestAnimationFrame(() => {
            menuContainer.style.opacity = "1";
            menuContainer.style.transform = "translateY(0)";
        });

        lastMenuShowTime = Date.now();

        const info = await fetchStudentInfo(studentId);
        renderMenuContent(studentId, info, false);
    }

    // --- HIDE MENU ON OUTSIDE CLICK ---
    function hideMenu(e) {
        if (e && menuContainer.contains(e.target)) return;
        if (Date.now() - lastMenuShowTime < 300) return;

        menuContainer.style.opacity = "0";
        menuContainer.style.transform = "translateY(-12px) rotateX(0deg) rotateY(0deg)";
        setTimeout(() => {
            menuContainer.style.display = "none";
            stopSnow();
        }, 300);
    }

    document.addEventListener("click", hideMenu);

    // --- 3D TILT EFFECT ---
    function handleMenuMouseMove(e) {
        if (menuContainer.style.display === "none") return;

        const rect = menuContainer.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const relX = (e.clientX - cx) / (rect.width / 2);
        const relY = (e.clientY - cy) / (rect.height / 2);

        const maxTilt = 6;
        const rotateX = -relY * maxTilt;
        const rotateY = relX * maxTilt;

        menuContainer.style.transform =
            `translateY(0px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    }

    function resetTilt() {
        menuContainer.style.transform = "translateY(0px) rotateX(0deg) rotateY(0deg)";
    }

    menuContainer.addEventListener("mousemove", handleMenuMouseMove);
    menuContainer.addEventListener("mouseleave", resetTilt);

    // --- KEYBOARD SHORTCUT: Alt+S to reopen last student ---
    document.addEventListener("keydown", (e) => {
        const active = document.activeElement;
        const tag = active && active.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (active && active.isContentEditable)) {
            return; // don't trigger while typing
        }

        if (e.altKey && e.key.toLowerCase() === 's') {
            if (!lastStudentId) return;
            e.preventDefault();
            const fallbackX = window.scrollX + 150;
            const fallbackY = window.scrollY + 150;
            showMenu(lastStudentId, lastPosX || fallbackX, lastPosY || fallbackY);
        }
    });

    // --- SNOWFLAKE ICON INJECTION: add ❄ next to every 7-digit ID ---
    function enhanceStudentIds(root) {
        root = root || document.body;
        if (!root) return;

        // Remove any existing snowflakes in this subtree so we don't duplicate
        const existing = root.querySelectorAll('.st-id-snowflake');
        existing.forEach(el => el.remove());

        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    if (!node.nodeValue || !/\d{7}/.test(node.nodeValue)) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    const parent = node.parentNode;
                    if (!parent) return NodeFilter.FILTER_REJECT;

                    const tag = parent.tagName;
                    if (!tag) return NodeFilter.FILTER_REJECT;

                    // Skip scripts, styles, textareas, inputs, our menu, and snowflake elements
                    if (['SCRIPT','STYLE','TEXTAREA'].includes(tag)) return NodeFilter.FILTER_REJECT;
                    if (parent.closest('input, textarea, [contenteditable="true"]')) return NodeFilter.FILTER_REJECT;
                    if (parent.closest('.st-id-snowflake')) return NodeFilter.FILTER_REJECT;
                    if (parent === menuContainer || (parent.closest && parent.closest('div') === menuContainer)) {
                        return NodeFilter.FILTER_REJECT;
                    }

                    return NodeFilter.FILTER_ACCEPT;
                }
            },
            false
        );

        const toProcess = [];
        let node;
        while ((node = walker.nextNode())) {
            toProcess.push(node);
        }

        toProcess.forEach(textNode => {
            const text = textNode.nodeValue;
            const regex = /\b(\d{7})\b/g;
            let match;
            let lastIndex = 0;
            const frag = document.createDocumentFragment();

            while ((match = regex.exec(text)) !== null) {
                const before = text.slice(lastIndex, match.index);
                if (before) {
                    frag.appendChild(document.createTextNode(before));
                }

                const idText = match[1];

                // ID text
                frag.appendChild(document.createTextNode(idText));

                // Snowflake icon
                const snow = document.createElement('span');
                snow.textContent = '❄';
                snow.className = 'st-id-snowflake';
                snow.dataset.studentId = idText;
                snow.title = 'Open student menu';
                frag.appendChild(document.createTextNode(' '));
                frag.appendChild(snow);

                lastIndex = regex.lastIndex;
            }

            const after = text.slice(lastIndex);
            if (after) {
                frag.appendChild(document.createTextNode(after));
            }

            if (textNode.parentNode) {
                textNode.parentNode.replaceChild(frag, textNode);
            }
        });
    }

    // Run once on page load
    function initEnhancement() {
        enhanceStudentIds(document.body);

        // Watch for future DOM changes (AJAX / SPA)
        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                m.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // ELEMENT_NODE
                        enhanceStudentIds(node);
                    }
                });
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEnhancement);
    } else {
        initEnhancement();
    }

    // --- CLICK HANDLER: snowflake icon opens the menu ---
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target && target.classList && target.classList.contains('st-id-snowflake')) {
            const studentId = target.dataset.studentId;
            if (!studentId) return;

            e.preventDefault();
            e.stopPropagation();

            showMenu(studentId, e.pageX, e.pageY);
        }
    }, true); // capture

})();
