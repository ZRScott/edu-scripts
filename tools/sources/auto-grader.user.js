// ==UserScript==
// @name         Auto Grader
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Auto-fills grading score boxes, adds half-score/feedback button, collapses rubric sections, and updates overall feedback.
// @match        *://*/*
// @all-frames   true
// @run-at       document-idle
// @grant        none
// @icon         https://www.svgrepo.com/show/289663/a-plus-result.svg
// ==/UserScript==

(function () {
  'use strict';

  console.log('[Auto-Grader] Script loaded in frame:', window.location.href);

  // ---- Scroll state ----
  let hasScrolled = false;       // scroll sequence finished
  let scrollStarted = false;     // scroll sequence in progress
  let userScrolled = false;      // user manually scrolled
  let lastInputCount = 0;
  let lastChangeTime = Date.now();

  const SETTLE_MS = 3000;        // wait this long with no new score boxes before scrolling

  const ITEM_FEEDBACK_MESSAGE = "Great start! You’re doing well—please don’t give up. If you want to go over it together, I’m happy to help—just book a time here: https://calendar.app.google/f6TJJhydYmgTzoPc9";

  const OVERALL_PASS_MSG = "Outstanding job on this assessment! You demonstrated a strong mastery of the concepts covered in this unit. Keep up the fantastic work!";
  const OVERALL_FAIL_MSG = "Great effort! You are making good progress, but there are a few key concepts we should review together to make sure you're feeling fully confident. I'm happy to help—please book a quick 1-on-1 review session with me here: https://calendar.app.google/f6TJJhydYmgTzoPc9";

  // Only real scrolling gestures count (not clicks/typing)
  ['wheel', 'touchmove'].forEach((evt) => {
    window.addEventListener(evt, () => { userScrolled = true; }, { passive: true, capture: true });
  });
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) {
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (!typing) userScrolled = true;
    }
  }, { passive: true, capture: true });

  document.addEventListener('visibilitychange', () => {
    // Restart the settle timer when the tab becomes visible
    if (!document.hidden) lastChangeTime = Date.now();
  });

  function autoGradeInputs() {
    // 1. Process score inputs
    const scoreInputs = document.querySelectorAll('input.grading_textbox');

    if (scoreInputs.length !== lastInputCount) {
      lastInputCount = scoreInputs.length;
      lastChangeTime = Date.now();
      if (scoreInputs.length > 0) {
        console.log(`[Auto-Grader] Found ${scoreInputs.length} score input box(es).`);
      }
    }

    scoreInputs.forEach((input) => {
      let maxScore = input.getAttribute('max');
      if (!maxScore) {
        const label = input.closest('.grading_block')?.querySelector('label');
        const match = label ? label.innerText.match(/0-(\d+)/) : null;
        if (match) maxScore = match[1];
      }

      const numericMax = parseInt(maxScore, 10);

      if (isNaN(numericMax) || numericMax <= 1) return;

      // Attach listeners so manual edits trigger overall feedback updates
      if (!input.dataset.autoGraderBound) {
        input.dataset.autoGraderBound = 'true';

        const handleUserEdit = () => {
          input.dataset.userInteracted = 'true';
          updateOverallFeedback();
        };

        input.addEventListener('focus', handleUserEdit);
        input.addEventListener('input', handleUserEdit);
        input.addEventListener('change', handleUserEdit);
      }

      // Initial auto-fill for un-graded items
      if ((input.value === '0' || input.value === '') && !input.dataset.userInteracted) {
        console.log(`[Auto-Grader] Updating box to ${numericMax}`);
        setInputValue(input, String(numericMax));
        input.dataset.autoGraderFilled = 'true';
        lastChangeTime = Date.now();
      }

      // Attach half-score button
      addHalfScoreButton(input);
    });

    // 2. Collapse extra sections (Rubrics & Question Feedback)
    collapseExtraSections();

    // 3. Update Overall Feedback based on current scores
    updateOverallFeedback();

    // 4. Auto-scroll once the page has settled
    maybeScroll();
  }

  function maybeScroll() {
    if (hasScrolled || scrollStarted || userScrolled) return;
    if (document.hidden) return;

    const first = document.querySelector('input.grading_textbox[data-auto-grader-filled]');
    if (!first) return;

    // Wait for the page to stop adding score boxes
    if (Date.now() - lastChangeTime < SETTLE_MS) return;

    scrollStarted = true;
    console.log('[Auto-Grader] Page settled, scrolling to first updated score.');

    // Repeat a few times to survive late layout shifts
    [0, 500, 1500, 3000].forEach((delay, i, arr) => {
      setTimeout(() => {
        if (userScrolled) { hasScrolled = true; return; }
        doScroll();
        if (i === arr.length - 1) hasScrolled = true;
      }, delay);
    });
  }

  function doScroll() {
    // Always re-resolve: first auto-filled box in DOM order
    const input = document.querySelector('input.grading_textbox[data-auto-grader-filled]') ||
                  document.querySelector('input.grading_textbox');
    if (!input) return;

    const target = input.closest('.lrn_widget') ||
                   input.closest('.lds-root') ||
                   input.closest('.grading_block') ||
                   input;

    target.scrollIntoView({ behavior: 'auto', block: 'start' });

    // Walk up through any (same-origin) parent frames
    try {
      let win = window;
      while (win.frameElement && win.parent !== win) {
        win.frameElement.scrollIntoView({ behavior: 'auto', block: 'start' });
        win = win.parent;
      }
    } catch (e) { /* cross-origin parent, ignore */ }
  }

  function updateOverallFeedback() {
    const inputs = document.querySelectorAll('input.grading_textbox');
    if (inputs.length === 0) return;

    let totalEarned = 0;
    let totalPossible = 0;

    inputs.forEach((input) => {
      let maxScore = input.getAttribute('max');
      if (!maxScore) {
        const label = input.closest('.grading_block')?.querySelector('label');
        const match = label ? label.innerText.match(/0-(\d+)/) : null;
        if (match) maxScore = match[1];
      }

      const earned = parseFloat(input.value) || 0;
      const max = parseFloat(maxScore) || 0;

      totalEarned += earned;
      totalPossible += max;
    });

    if (totalPossible === 0) return;

    const percentage = (totalEarned / totalPossible) * 100;
    const overallContainer = document.querySelector('.overall-feedback');

    if (!overallContainer) return;

    const targetMessage = percentage >= 80 ? OVERALL_PASS_MSG : OVERALL_FAIL_MSG;

    // Attempt insertion into overall feedback box
    if (overallContainer.dataset.lastAppliedMessage !== targetMessage) {
      const success = setFeedbackText(overallContainer, targetMessage);
      if (success) {
        overallContainer.dataset.lastAppliedMessage = targetMessage;
        console.log(`[Auto-Grader] Total percentage: ${percentage.toFixed(1)}%. Updated overall feedback.`);
      }
    }
  }

  function addHalfScoreButton(input) {
    if (input.dataset.halfBtnAdded) return;
    input.dataset.halfBtnAdded = 'true';

    const halfBtn = document.createElement('button');
    halfBtn.type = 'button';
    halfBtn.className = 'auto-grader-half-btn';
    halfBtn.innerText = '½ Score & Feedback';
    halfBtn.style.cssText = `
      margin-left: 8px;
      padding: 4px 10px;
      background-color: #fff3cd;
      color: #856404;
      border: 1px solid #ffeeba;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      display: inline-block;
      vertical-align: middle;
    `;

    halfBtn.addEventListener('click', (e) => {
      e.preventDefault();

      input.dataset.userInteracted = 'true';

      const currentVal = parseFloat(input.value) || 0;
      const halfVal = Math.round((currentVal / 2) * 10) / 10;
      setInputValue(input, String(halfVal));

      // Find parent wrapper for this specific item
      const itemWrapper = input.closest('[data-lrn-widget-type="question"]') ||
                          input.closest('.learnosity-item') ||
                          input.closest('.col-xs-12') ||
                          input.parentElement;

      setFeedbackText(itemWrapper, ITEM_FEEDBACK_MESSAGE);

      halfBtn.innerText = '✓ Half Scored & Feedback Added';
      halfBtn.style.backgroundColor = '#d4edda';
      halfBtn.style.color = '#155724';
      halfBtn.style.borderColor = '#c3e6cb';

      // Instantly update overall test feedback
      updateOverallFeedback();
    });

    input.insertAdjacentElement('afterend', halfBtn);
  }

  function setFeedbackText(container, message) {
    if (!container) return false;

    // Ensure we isolate the feedback box and NOT the student's answer area
    const feedbackBox = container.classList.contains('feedback-container')
      ? container
      : container.querySelector('.feedback-container');

    if (!feedbackBox) return false;

    const targetEditor = feedbackBox.querySelector('.lrn_editor_area, [contenteditable="true"], textarea, input');

    if (!targetEditor) return false;

    if (targetEditor.tagName.toLowerCase() === 'textarea' || targetEditor.tagName.toLowerCase() === 'input') {
      setInputValue(targetEditor, message);
    } else {
      targetEditor.innerHTML = `<p>${message}</p>`;
      targetEditor.dispatchEvent(new Event('input', { bubbles: true }));
      targetEditor.dispatchEvent(new Event('change', { bubbles: true }));
      targetEditor.dispatchEvent(new Event('blur', { bubbles: true }));
      targetEditor.dispatchEvent(new Event('keyup', { bubbles: true }));
    }

    return true;
  }

  function collapseExtraSections() {
    const gradingBlocks = document.querySelectorAll('.grading_block');

    gradingBlocks.forEach((block) => {
      if (block.dataset.toggleInitialized) return;

      const itemWrapper = block.closest('.learnosity-item') ||
                          block.closest('.row') ||
                          block.closest('.col-xs-12') ||
                          block.parentElement;

      if (!itemWrapper) return;

      const feedbackContainers = itemWrapper.querySelectorAll('.feedback-container:not(.overall-feedback)');
      const featureWidgets = itemWrapper.querySelectorAll('[data-lrn-widget-type="feature"], .lrn_feature');
      const sampleAnswers = itemWrapper.querySelectorAll('[id^="sampleanswer_"]');

      const extraElements = [
        ...Array.from(feedbackContainers),
        ...Array.from(featureWidgets),
        ...Array.from(sampleAnswers)
      ];

      if (extraElements.length === 0) return;

      block.dataset.toggleInitialized = 'true';

      extraElements.forEach((el) => {
        el.style.display = 'none';
      });

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'auto-grader-toggle-btn';
      toggleBtn.innerText = '💬 Show Rubric & Feedback';
      toggleBtn.style.cssText = `
        margin: 10px 0;
        padding: 6px 14px;
        background-color: #f5f5f5;
        color: #333;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        display: inline-block;
      `;

      toggleBtn.addEventListener('click', () => {
        const isCurrentlyHidden = extraElements[0].style.display === 'none';
        extraElements.forEach((el) => {
          el.style.display = isCurrentlyHidden ? 'block' : 'none';
        });
        toggleBtn.innerText = isCurrentlyHidden
          ? '💬 Hide Rubric & Feedback'
          : '💬 Show Rubric & Feedback';
        toggleBtn.style.backgroundColor = isCurrentlyHidden ? '#e0e0e0' : '#f5f5f5';
      });

      block.parentNode.insertBefore(toggleBtn, block.nextSibling);
    });
  }

  function setInputValue(input, newValue) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeSetter) {
      nativeSetter.call(input, newValue);
    } else {
      input.value = newValue;
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  setTimeout(() => {
    autoGradeInputs();
    setInterval(autoGradeInputs, 1000);
  }, 3000);
})();