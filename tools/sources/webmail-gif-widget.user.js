// ==UserScript==
// @name         Webmail GIF Widget
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @description  Displays a dynamic GIF widget in WM, hides behind search modal, forces 200px height on drop.
// @icon         https://www.svgrepo.com/show/270194/gif.svg
// @author       Glenn Rusher
// @match        https://www.connexus.com/webmail*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- Configuration ---
    const CONFIG = {
        positioningTargetSelector: '.addFolder',
        widthReferenceSelector: '.treeWrapper',
        searchModalSelector: '.webmailModalLeftPanel',
        mainMutationObserverTarget: document.body,
        debounceTime: 50,
        minWidgetWidth: 150,
        minWidgetHeight: 100,
        widgetTopOffset: 10,
        widgetBottomMargin: 20,
        gifGridMinItemWidth: '80px',
        droppedGifHeight: 200, // Target height in pixels when dragged into email
        debug: false,
        widgetId: 'dynamic-gif-widget-container',
        widgetBaseZIndex: '9999',
        widgetHiddenZIndex: '10'
    };

    function logDebug(...args) {
        if (CONFIG.debug) {
            console.log('[GIF Widget]', ...args);
        }
    }

    function initializeGifWidget() {
        logDebug('Attempting to initialize GIF Widget...');

        if (document.getElementById(CONFIG.widgetId)) {
            logDebug('Widget already exists. Skipping initialization.');
            return;
        }

        let widget = null;
        let observedWidthRefByResize = null;
        let observedPosTargetByResize = null;
        let resizeObserverInstance = null;
        let mainMutationObserverInstance = null;
        let searchModalObserverInstance = null;
        let windowResizeListenerAttached = false;
        let isSearchModalCurrentlyVisible = false;

        function updateWidgetLayout() {
            if (!widget || !document.body.contains(widget)) {
                logDebug("Widget not found or not in DOM. Skipping layout update.");
                return;
            }

            if (isSearchModalCurrentlyVisible) {
                logDebug("Search modal is visible, keeping widget hidden/behind.");
                if (widget.style.zIndex !== CONFIG.widgetHiddenZIndex) {
                    widget.style.zIndex = CONFIG.widgetHiddenZIndex;
                }
                return;
            }

            if (widget.style.zIndex === CONFIG.widgetHiddenZIndex) {
                widget.style.zIndex = CONFIG.widgetBaseZIndex;
            }

            const currentPositioningTarget = document.querySelector(CONFIG.positioningTargetSelector);
            const currentWidthReference = document.querySelector(CONFIG.widthReferenceSelector);

            if (!currentPositioningTarget || !currentWidthReference) {
                logDebug("Critical elements for layout not found during update. Skipping.");
                return;
            }

            try {
                const positionRect = currentPositioningTarget.getBoundingClientRect();
                const widthRefRect = currentWidthReference.getBoundingClientRect();

                if (positionRect.width === 0 && positionRect.height === 0 && positionRect.top === 0 && positionRect.left === 0) {
                    logDebug(CONFIG.positioningTargetSelector, "rect is all zeros. Skipping layout update.");
                    return;
                }

                const calculatedWidth = widthRefRect.width;
                const windowHeight = window.innerHeight;
                const spaceBelow = windowHeight - positionRect.bottom - CONFIG.widgetBottomMargin;
                const maxWidgetHeight = Math.max(CONFIG.minWidgetHeight, spaceBelow);
                const widgetPadding = widget.style.padding ? parseInt(widget.style.padding) * 2 : 20;
                const availableViewportWidth = window.innerWidth - widthRefRect.left - widgetPadding - 10;

                widget.style.top = `${positionRect.bottom + CONFIG.widgetTopOffset}px`;
                widget.style.left = `${widthRefRect.left}px`;
                widget.style.width = `${Math.min(Math.max(calculatedWidth, CONFIG.minWidgetWidth), availableViewportWidth)}px`;
                widget.style.maxHeight = `${maxWidgetHeight}px`;

                logDebug(`Layout Updated: Top: ${widget.style.top}, Left: ${widget.style.left}, Width: ${widget.style.width}`);
            } catch (error) {
                console.error("[GIF Widget] Error during updateWidgetLayout:", error);
            }
        }

        const debouncedUpdateLayout = debounce(() => {
            window.requestAnimationFrame(updateWidgetLayout);
        }, CONFIG.debounceTime);

        function createAndSetupWidget() {
            if (widget) return true;

            const posTarget = document.querySelector(CONFIG.positioningTargetSelector);
            const widthRef = document.querySelector(CONFIG.widthReferenceSelector);
            if (!posTarget || !widthRef) {
                logDebug("Target elements for widget creation not found. Aborting.");
                return false;
            }

            widget = document.createElement('div');
            widget.id = CONFIG.widgetId;
            widget.style.position = 'fixed';
            widget.style.background = 'rgba(255, 255, 255, 0.9)';
            widget.style.borderRadius = '10px';
            widget.style.padding = '10px';
            widget.style.boxSizing = 'border-box';
            widget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            widget.style.zIndex = CONFIG.widgetBaseZIndex;
            widget.style.overflowY = 'auto';
            widget.style.userSelect = 'none';

            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = `repeat(auto-fit, minmax(${CONFIG.gifGridMinItemWidth}, 1fr))`;
            grid.style.gap = '10px';

            const gifs = [
                'https://media.giphy.com/media/GXD04gzl9ca2TiFoGb/giphy.gif?cid=790b76117f869a860cbe5fe5b31c4306b0da35e4f5245085&ep=v1_user_favorites&rid=giphy.gif&ct=g',
                'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExc2RwbnJobDdtNXRud2V4c3FzcnE3a2FjZXR2MzI2aGg1ZHJibXN6MiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/cPea2NiqqG7JHfOTj2/giphy.gif',
                'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnBjamY4YzY4OXMxMjJhNXppdHFwZWp6dXhoNWU3ZmxsYWw3eXczaiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/1hXY6iNdTFpTW4je85/giphy.gif',
                'https://media.giphy.com/media/NEvPzZ8bd1V4Y/giphy.gif?cid=ecf05e47zrh9pt8jg5yqa18ja794tqcyb0op6rd0da5gtz06&ep=v1_gifs_search&rid=giphy.gif&ct=g',
                'https://media.giphy.com/media/pVCfT3zV70XcCRFrUZ/giphy.gif?cid=ecf05e47ia10vlkm5eqwkrdcbv7cbs0jqhpa7xxi4cyedna6&ep=v1_stickers_related&rid=giphy.gif&ct=s',
                'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmY5NW1oYTNldHdyeW1rcmE0OHdkaHM3MXQ4eHRsanJwMDh4b2h4ZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/IazdAV1zjaGbBaGPgF/giphy.gif',
                'https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExc2djNHJveXhxNDFwaHU0YmRzc3d2eWUwNTB1dTk4NWxmeTVvZW1qYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/wyi5tYZJvkMLIgRmXv/giphy.gif',
                'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExcXI4OHdqZnNuN2o5OTc1Z2ZnNHMwOGZmbXAxandmeTRvZGNvMGk4ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7abGQa0aRJUurpII/giphy.gif',
                'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExZWNvOGgwMzdnYnFiZ2g4N2g4ZHB6djRqYzVrZ2dtazN0OTltY3RodiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/l0Iyei5MxFUMpoPAI/giphy.gif',
                'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExMHRyOXRyYmExajEyYmFrbzFpcDFuM2VwbGprM2ZzcW14Y3Jvd25zZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/fWfowxJtHySJ0SGCgN/giphy.gif',
                'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExZTZkYzR1a3VpMGs2OGp2d3Zvb3Fxdzhxdnl1NTdpa3AwODBuN2VoYiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/fdyZ3qI0GVZC0/giphy.gif',
                'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExamV0a3Mwem84dzNubXR5ZWcwamR0d25mOTNydThjam90M2loZXhsYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/ely3apij36BJhoZ234/giphy.gif',
                'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExcTIxOXN1c3RxcXppdTlvaTdhMHJwNzNvZmpzdTZnaDVxbzY3cDcwZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/d31w24psGYeekCZy/giphy.gif',
                'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdjFobDd4dHhndmg2dnY3aThkNDJzaWxsYmw3N2dhOTg1ODh3cGp6cyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/bZmFlbPoX7WyHTzhuV/giphy.gif',
                'https://media.giphy.com/media/3o6Mbfy4J60GaztSvu/giphy.gif?cid=ecf05e47tnpxzn97w9u1o8m0z7k0dqmvvmmgkx2ub7vmk0tv&ep=v1_gifs_search&rid=giphy.gif&ct=g',
                'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExZ2JrZTdwazUwOXhpa2lzNzgzOWVlODRrbWZ4Y2I4cnp4NW9nNnBxbyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/mpaPHV61gqkopMWUz0/giphy.gif',
                'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExOGFodjN5cmVjbDI2d2UyczhlZHQxcDFtMW1jcno0amdjczI5N2QweCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/lUNOmDM1g6iS9RLXt1/giphy.gif',
                'https://media.giphy.com/media/XcAa52ejGuNqdb5SFQ/giphy.gif?cid=790b7611yhxjjcq54wkltme8pybe7mun0639a4se5u7i5nnf&ep=v1_gifs_search&rid=giphy.gif&ct=g',
                'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExNW5hNDZjeDZjYWV6cDJkMHV4cmYyNGdhdjYwYXc5Ymp1OWNoY216ZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/2rABGk0WV4wHDvznj1/giphy.gif',
                'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExN2Y4NjlhODYwY2JlNWZlNWIzMWM0MzA2YjBkYTM1ZTRmNTI0NTA4NSZlcD12MV91c2VyX2Zhdm9yaXRlcyZjdD1n/l41lZxzroU33typuU/giphy.gif',
                'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXYzcHlsdm5yejF4eGY3MXZ1NjRjeml3d3Vic2EzeDRwdHhjajdpdyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9dHM/pyTi70C7xmAR7KUEdA/giphy.gif',
                'https://media4.giphy.com/media/V1dH38rUl9yX7xU8nh/giphy.gif?cid=5a38a5a24o72zy6wulll3iycfosw98obwsrfb0ymx8bh7iq9&ep=v1_gifs_search&rid=giphy.gif&ct=g',
                'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExMGIwYWIydXA3enFjNGtub2k2a3Y5djFvZmZqcXJranRtdzN4ZGVpYSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/bATq9Ga54acx2/giphy.gif',
                'https://media.giphy.com/media/5Zesu5VPNGJlm/giphy.gif?cid=790b7611swrrm3v0d4sdn82j81tzcxfm1hymi90mya3r9u8s&ep=v1_gifs_search&rid=giphy.gif&ct=g',
                'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExOW0xc3Zpa21rdWN3NmlhNDVhZ3lidWJxdDk0Y3pmZDFoYnRhZmlsMiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/12XDYvMJNcmLgQ/giphy.gif',
                'https://media.giphy.com/media/Jn9Td3EAh6cJfiyg60/giphy.gif?cid=790b7611j7150qimg9prdo4vcmrmd5ly21e768li1qqohu2t&ep=v1_gifs_search&rid=giphy.gif&ct=g',
                'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExYnFrdjVrdXVpdWZreTdrYWk4eXByZHpqZzVhaDF2a2R5YjdtdGpyNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3otPoS81loriI9sO8o/giphy.gif',
                'https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXZnYTRwamV0a3pteXdlcHZ2NnZ1aDNoeDV3d2lpbTdqOWcxc3JlcyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3ohhweiVB36rAlqVCE/giphy.gif',
                'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdGxoaG1ldjkyZDlwZnJ1aHcza2JwNzVjZGZ3NDMzZnUwYjYzZW0xYiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/xJlt4va0iRW3uSzTrV/giphy.gif',
                'https://i.imgur.com/JoG46io.gif',
                'https://media0.giphy.com/media/v1.Y2lkPTc5MGI3NjExdWY0M3UzejN5dXM5cWJ6eXQxZ21yMWQ5OTV2azV3YmNjYWptNDA4ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/TuVW0TmhLvMpk8cCC9/giphy.gif',
                'https://media.giphy.com/media/xTiN0CNHgoRf1Ha7CM/giphy.gif?cid=ecf05e47scteq5xurd6wdjqgy65g9xp6tzck91e6lh3jxg82&ep=v1_gifs_search&rid=giphy.gif&ct=g',
                'https://media.giphy.com/media/o7ZDUPtDofoNFsXpa8/giphy.gif?cid=ecf05e47a4mfrqwl4qk1wjtjet6q028fyvbcyvldcvpon5d3&ep=v1_gifs_search&rid=giphy.gif&ct=g',
                'https://media.giphy.com/media/QbETS1Oznh7d0cOJgd/giphy.gif?cid=ecf05e47vyxrhafdufpnm2tl3y8ieq4x5dm8w5ickwtzxsjq&ep=v1_gifs_search&rid=giphy.gif&ct=g',
                'https://media.giphy.com/media/nYYtQdLqwwlTe3ccKh/giphy.gif?cid=ecf05e47laiz5s7ham9wm3we7veczkp8mi5u4pv78w41x&ep=v1_gifs_search&rid=giphy.gif&ct=g',
                'https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExeTR1Ynh5d212ZHJhdGdhOGI2d2NkZTBldTh1c3h5djZ4NWx5Ymk5MyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/12vJgj7zMN3jPy/giphy.gif',
                'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdjcyNDJyYXhmYjJ0NW5jbGdrd2NmOWh2bjYwdDd2dDg4cXdub3NweCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/XHikmS4atPjYQ/giphy.gif'
            ];

            gifs.forEach(gifUrl => {
                if (gifUrl && typeof gifUrl === 'string' && gifUrl.trim() !== '') {
                    const img = document.createElement('img');
                    img.src = gifUrl;
                    img.style.width = '100%';
                    img.style.height = 'auto';
                    img.style.display = 'block';
                    img.style.borderRadius = '5px';
                    img.style.cursor = 'grab';
                    img.alt = 'GIF';
                    img.loading = 'lazy';

                    // Attach custom HTML transfer data to force height when dropped into the rich text editor
                    img.addEventListener('dragstart', (e) => {
                        const targetHeight = CONFIG.droppedGifHeight;
                        const customHtml = `<img src="${gifUrl}" height="${targetHeight}" style="height: ${targetHeight}px; width: auto;" alt="GIF" />`;

                        if (e.dataTransfer) {
                            e.dataTransfer.setData('text/html', customHtml);
                            e.dataTransfer.setData('text/plain', gifUrl);
                        }
                    });

                    grid.appendChild(img);
                }
            });

            widget.appendChild(grid);
            document.body.appendChild(widget);
            logDebug("Widget created and appended to body.");
            return true;
        }

        function setupResizeObserverTargets() {
            if (!resizeObserverInstance || !widget) return;
            const currentWidthRef = document.querySelector(CONFIG.widthReferenceSelector);
            const currentPosTarget = document.querySelector(CONFIG.positioningTargetSelector);

            if (currentWidthRef) {
                if (currentWidthRef !== observedWidthRefByResize) {
                    if (observedWidthRefByResize) resizeObserverInstance.unobserve(observedWidthRefByResize);
                    resizeObserverInstance.observe(currentWidthRef);
                    observedWidthRefByResize = currentWidthRef;
                    logDebug("ResizeObserver watching new widthReference.");
                }
            } else if (observedWidthRefByResize) {
                resizeObserverInstance.unobserve(observedWidthRefByResize);
                observedWidthRefByResize = null;
            }

            if (currentPosTarget) {
                if (currentPosTarget !== observedPosTargetByResize) {
                    if (observedPosTargetByResize) resizeObserverInstance.unobserve(observedPosTargetByResize);
                    resizeObserverInstance.observe(currentPosTarget);
                    observedPosTargetByResize = currentPosTarget;
                    logDebug("ResizeObserver watching new positioningTarget.");
                }
            } else if (observedPosTargetByResize) {
                resizeObserverInstance.unobserve(observedPosTargetByResize);
                observedPosTargetByResize = null;
            }
        }

        function initializeEssentialObservers() {
            if (typeof ResizeObserver !== 'undefined') {
                if (!resizeObserverInstance) {
                    resizeObserverInstance = new ResizeObserver(() => {
                        logDebug("ResizeObserver triggered");
                        debouncedUpdateLayout();
                    });
                    resizeObserverInstance.observe(document.body);
                    logDebug("ResizeObserver for body initialized.");
                }
            } else if (!windowResizeListenerAttached) {
                logDebug("ResizeObserver not supported. Adding window.resize fallback.");
                window.addEventListener('resize', debouncedUpdateLayout);
                windowResizeListenerAttached = true;
            }
        }

        function handleSearchModalVisibility(modalElement) {
            if (!widget || !modalElement) return;

            const computedStyle = window.getComputedStyle(modalElement);
            const modalIsDisplayed = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
            const modalHasSelectedClass = modalElement.classList.contains('selected');
            const newModalVisibility = modalIsDisplayed || modalHasSelectedClass;

            if (newModalVisibility && !isSearchModalCurrentlyVisible) {
                logDebug("Search modal became visible. Hiding widget.");
                widget.style.zIndex = CONFIG.widgetHiddenZIndex;
                isSearchModalCurrentlyVisible = true;
            } else if (!newModalVisibility && isSearchModalCurrentlyVisible) {
                logDebug("Search modal hidden. Restoring widget layout.");
                widget.style.zIndex = CONFIG.widgetBaseZIndex;
                isSearchModalCurrentlyVisible = false;
                debouncedUpdateLayout();
            }
        }

        if (typeof MutationObserver !== 'undefined') {
            mainMutationObserverInstance = new MutationObserver((mutationsList) => {
                if (!widget) {
                    const posTarget = document.querySelector(CONFIG.positioningTargetSelector);
                    const widthRef = document.querySelector(CONFIG.widthReferenceSelector);
                    if (posTarget && widthRef) {
                        logDebug("Target elements appeared. Creating widget.");
                        if (createAndSetupWidget()) {
                            initializeEssentialObservers();
                            setupResizeObserverTargets();
                            debouncedUpdateLayout();
                            const searchModal = document.querySelector(CONFIG.searchModalSelector);
                            if (searchModal && !searchModalObserverInstance) {
                                setupSearchModalObserver(searchModal);
                            }
                        }
                    }
                }

                if (widget) {
                    let relevantMutation = false;
                    const searchModalEl = document.querySelector(CONFIG.searchModalSelector);

                    for (const mutation of mutationsList) {
                        if (mutation.target === searchModalEl || (mutation.addedNodes && Array.from(mutation.addedNodes).includes(searchModalEl))) {
                            if (searchModalEl) handleSearchModalVisibility(searchModalEl);
                        }

                        if ((mutation.type === 'childList' || mutation.type === 'attributes') &&
                            (!widget.contains(mutation.target) && mutation.target !== widget)) {
                            relevantMutation = true;
                        }
                    }

                    if (relevantMutation && !isSearchModalCurrentlyVisible) {
                        logDebug("Relevant mutation detected.");
                        if (resizeObserverInstance) {
                            setupResizeObserverTargets();
                        }
                        debouncedUpdateLayout();
                    }
                }
            });

            mainMutationObserverInstance.observe(CONFIG.mainMutationObserverTarget, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['style', 'class']
            });

            if (!widget) {
                const posTarget = document.querySelector(CONFIG.positioningTargetSelector);
                const widthRef = document.querySelector(CONFIG.widthReferenceSelector);
                if (posTarget && widthRef) {
                    logDebug("Target elements present on initial check. Creating widget.");
                    if (createAndSetupWidget()) {
                        initializeEssentialObservers();
                        setupResizeObserverTargets();
                        debouncedUpdateLayout();
                        const searchModal = document.querySelector(CONFIG.searchModalSelector);
                        if (searchModal && !searchModalObserverInstance) {
                            setupSearchModalObserver(searchModal);
                            handleSearchModalVisibility(searchModal);
                        }
                    }
                }
            }
        }

        function setupSearchModalObserver(modalElement) {
            if (typeof MutationObserver === 'undefined' || !modalElement) return;
            if (searchModalObserverInstance) searchModalObserverInstance.disconnect();

            searchModalObserverInstance = new MutationObserver((mutationsList) => {
                for (const mutation of mutationsList) {
                    if (mutation.type === 'attributes' && (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                        handleSearchModalVisibility(modalElement);
                        break;
                    }
                }
                handleSearchModalVisibility(modalElement);
            });

            searchModalObserverInstance.observe(modalElement, {
                attributes: true,
                attributeFilter: ['class', 'style']
            });
            handleSearchModalVisibility(modalElement);
        }

        const initialSearchModal = document.querySelector(CONFIG.searchModalSelector);
        if (initialSearchModal) {
            setupSearchModalObserver(initialSearchModal);
        }
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    initializeGifWidget();
})();