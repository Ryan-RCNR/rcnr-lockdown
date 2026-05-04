"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  INSTANT_SUBMIT_VIOLATIONS: () => INSTANT_SUBMIT_VIOLATIONS,
  ResetAccessConfirm: () => ResetAccessConfirm,
  ResumeBanner: () => ResumeBanner,
  ViolationLogPreview: () => ViolationLogPreview,
  useLockdown: () => useLockdown
});
module.exports = __toCommonJS(index_exports);

// src/useLockdown.ts
var import_react = require("react");

// src/types.ts
var INSTANT_SUBMIT_VIOLATIONS = /* @__PURE__ */ new Set([
  "paste_attempt",
  "copy_attempt",
  "cut_attempt",
  "drop_attempt",
  "devtools_attempt",
  "extension_detected",
  "voice_input",
  "pip_detected"
]);

// src/useLockdown.ts
var DEFAULT_GRACE_PERIOD_MS = 5e3;
var WARNING_DISPLAY_MS = 5e3;
var DEVTOOLS_KEYS = ["I", "J", "C", "K"];
var BLUR_SUPPRESS_AFTER_FS_EXIT_MS = 500;
var FULLSCREEN_REENTRY_SECONDS = 5;
var MAX_FULLSCREEN_EXITS = 3;
var OS_POPUP_GRACE_MS = 1500;
var FOCUS_POLL_INTERVAL_MS = 500;
var FOCUS_POLL_COOLDOWN_MS = 2e3;
function detectMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const hasTouch = navigator.maxTouchPoints > 0;
  const isSmallScreen = window.screen.width < 1024;
  const mobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|Opera Mini|IEMobile/i.test(
    navigator.userAgent
  );
  return mobileUA || hasTouch && isSmallScreen;
}
function useLockdown({
  enabled,
  gracePeriodMs = DEFAULT_GRACE_PERIOD_MS,
  onAutoSubmit,
  onViolation
}) {
  const [isFullscreen, setIsFullscreen] = (0, import_react.useState)(false);
  const [violations, setViolations] = (0, import_react.useState)([]);
  const [warning, setWarning] = (0, import_react.useState)(null);
  const [isMobileDevice] = (0, import_react.useState)(() => detectMobileDevice());
  const [fullscreenCountdown, setFullscreenCountdown] = (0, import_react.useState)(
    null
  );
  const [strikesRemaining, setStrikesRemaining] = (0, import_react.useState)(MAX_FULLSCREEN_EXITS);
  const [hasEnteredFullscreen, setHasEnteredFullscreen] = (0, import_react.useState)(false);
  const graceRef = (0, import_react.useRef)(false);
  const fullscreenExitCountRef = (0, import_react.useRef)(0);
  const lastFsExitRef = (0, import_react.useRef)(0);
  const countdownIntervalRef = (0, import_react.useRef)(
    null
  );
  const countdownStartRef = (0, import_react.useRef)(0);
  const autoSubmittedRef = (0, import_react.useRef)(false);
  const internalDragRef = (0, import_react.useRef)(false);
  const internalClipboardRef = (0, import_react.useRef)(null);
  const hasEnteredFullscreenRef = (0, import_react.useRef)(false);
  const lastFocusPollViolationRef = (0, import_react.useRef)(0);
  const pendingFsExitTimerRef = (0, import_react.useRef)(
    null
  );
  const onAutoSubmitRef = (0, import_react.useRef)(onAutoSubmit);
  (0, import_react.useEffect)(() => {
    onAutoSubmitRef.current = onAutoSubmit;
  }, [onAutoSubmit]);
  const onViolationRef = (0, import_react.useRef)(onViolation);
  (0, import_react.useEffect)(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);
  const triggerAutoSubmit = (0, import_react.useCallback)(() => {
    if (autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    onAutoSubmitRef.current();
  }, []);
  const clearCountdown = (0, import_react.useCallback)(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    countdownStartRef.current = 0;
    setFullscreenCountdown(null);
  }, []);
  const startCountdown = (0, import_react.useCallback)(() => {
    clearCountdown();
    countdownStartRef.current = Date.now();
    setFullscreenCountdown(FULLSCREEN_REENTRY_SECONDS);
    countdownIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - countdownStartRef.current) / 1e3;
      const remaining = Math.max(
        0,
        Math.ceil(FULLSCREEN_REENTRY_SECONDS - elapsed)
      );
      setFullscreenCountdown(remaining);
      if (remaining <= 0) {
        clearCountdown();
        triggerAutoSubmit();
      }
    }, 500);
  }, [clearCountdown, triggerAutoSubmit]);
  (0, import_react.useEffect)(() => {
    return () => clearCountdown();
  }, [clearCountdown]);
  const addViolation = (0, import_react.useCallback)(
    (type) => {
      if (graceRef.current) return;
      if (!hasEnteredFullscreenRef.current) return;
      if (autoSubmittedRef.current) return;
      const v = { type, timestamp: Date.now() };
      setViolations((prev) => [...prev, v]);
      onViolationRef.current?.(v);
      if (INSTANT_SUBMIT_VIOLATIONS.has(type)) {
        setWarning("Your work has been submitted.");
        triggerAutoSubmit();
        return;
      }
      if (type === "fullscreen_exit" || type === "window_blur" || type === "tab_switch") {
        fullscreenExitCountRef.current += 1;
        const remaining = MAX_FULLSCREEN_EXITS - fullscreenExitCountRef.current;
        setStrikesRemaining(remaining);
        if (remaining < 0) {
          setWarning("Your work has been submitted.");
          triggerAutoSubmit();
        } else if (remaining === 0) {
          setWarning(
            "Final warning: leave this window again and your work will be auto-submitted."
          );
          setTimeout(() => setWarning(null), WARNING_DISPLAY_MS);
          startCountdown();
        } else {
          setWarning(
            `Warning: you left the writing window. You have ${remaining} chance${remaining > 1 ? "s" : ""} left.`
          );
          setTimeout(() => setWarning(null), WARNING_DISPLAY_MS);
          startCountdown();
        }
      }
    },
    [triggerAutoSubmit, startCountdown]
  );
  const enterFullscreen = (0, import_react.useCallback)(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
      clearCountdown();
      if (!hasEnteredFullscreenRef.current) {
        hasEnteredFullscreenRef.current = true;
        setHasEnteredFullscreen(true);
        graceRef.current = true;
        setTimeout(() => {
          graceRef.current = false;
        }, gracePeriodMs);
      } else {
        setHasEnteredFullscreen(true);
      }
    } catch {
      if (hasEnteredFullscreenRef.current) {
        startCountdown();
      }
    }
  }, [gracePeriodMs, clearCountdown, startCountdown]);
  (0, import_react.useEffect)(() => {
    if (!enabled) return;
    function handleBeforeUnload(e) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled]);
  (0, import_react.useEffect)(() => {
    if (!enabled) return;
    function handleFullscreenChange() {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (fs) {
        hasEnteredFullscreenRef.current = true;
        setHasEnteredFullscreen(true);
        clearCountdown();
        if (pendingFsExitTimerRef.current) {
          clearTimeout(pendingFsExitTimerRef.current);
          pendingFsExitTimerRef.current = null;
          setWarning(
            "An OS popup briefly took focus. This didn't count as a strike \u2014 please dismiss any popups quickly so it doesn't happen again."
          );
          setTimeout(() => setWarning(null), WARNING_DISPLAY_MS);
        }
      } else if (!graceRef.current && hasEnteredFullscreenRef.current) {
        lastFsExitRef.current = Date.now();
        if (pendingFsExitTimerRef.current) {
          clearTimeout(pendingFsExitTimerRef.current);
        }
        pendingFsExitTimerRef.current = setTimeout(() => {
          pendingFsExitTimerRef.current = null;
          if (document.fullscreenElement) return;
          addViolation("fullscreen_exit");
        }, OS_POPUP_GRACE_MS);
      }
    }
    function handleVisibilityChange() {
      if (document.hidden && !graceRef.current && !countdownIntervalRef.current) {
        addViolation("tab_switch");
      }
    }
    function handleBlur() {
      if (graceRef.current) return;
      if (Date.now() - lastFsExitRef.current < BLUR_SUPPRESS_AFTER_FS_EXIT_MS)
        return;
      addViolation("window_blur");
    }
    function readSelectionText() {
      const docSel = typeof window !== "undefined" ? window.getSelection() : null;
      const docText = docSel ? docSel.toString() : "";
      if (docText) return docText;
      const active = document.activeElement;
      if (active && (active.tagName === "TEXTAREA" || active.tagName === "INPUT") && typeof active.selectionStart === "number" && typeof active.selectionEnd === "number") {
        return active.value.slice(active.selectionStart, active.selectionEnd);
      }
      return "";
    }
    function normalizeForCompare(s) {
      return s.replace(/\s+/g, " ").trim();
    }
    function handleCopy(e) {
      const text = readSelectionText();
      if (text) {
        internalClipboardRef.current = text;
      }
    }
    function handleCut(e) {
      const text = readSelectionText();
      if (text) {
        internalClipboardRef.current = text;
      }
    }
    function handlePaste(e) {
      const ce = e;
      const stash = internalClipboardRef.current;
      let pasted = "";
      let clipboardReadable = true;
      try {
        if (!ce.clipboardData) {
          clipboardReadable = false;
        } else {
          pasted = ce.clipboardData.getData("text") || "";
          if (!pasted && stash) {
            clipboardReadable = false;
          }
        }
      } catch {
        clipboardReadable = false;
      }
      if (clipboardReadable && pasted && stash && normalizeForCompare(pasted) === normalizeForCompare(stash)) {
        return;
      }
      if (!clipboardReadable && stash) {
        internalClipboardRef.current = null;
        return;
      }
      e.preventDefault();
      addViolation("paste_attempt");
    }
    function handleDragStart() {
      internalDragRef.current = true;
    }
    function handleDragEnd() {
      internalDragRef.current = false;
    }
    function handleDrop(e) {
      if (internalDragRef.current) {
        internalDragRef.current = false;
        return;
      }
      e.preventDefault();
      addViolation("drop_attempt");
    }
    function handleDragOver(e) {
      e.preventDefault();
    }
    function handleKeydown(e) {
      const modKey = e.ctrlKey || e.metaKey;
      if (e.key === "F12") {
        e.preventDefault();
        addViolation("devtools_attempt");
        return;
      }
      if (modKey && e.shiftKey && DEVTOOLS_KEYS.includes(e.key.toUpperCase())) {
        e.preventDefault();
        addViolation("devtools_attempt");
        return;
      }
      if (modKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        addViolation("window_blur");
        return;
      }
      if (modKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        return;
      }
      if (modKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        return;
      }
      if (modKey && (e.key.toLowerCase() === "f" || e.key.toLowerCase() === "h")) {
        e.preventDefault();
        return;
      }
      if (e.altKey && e.key === "Tab") {
        e.preventDefault();
        return;
      }
      if (e.key === "Meta" || e.key === "OS") {
        e.preventDefault();
        return;
      }
    }
    function handleContextMenu(e) {
      e.preventDefault();
    }
    function handleBeforeInput(e) {
      const inputEvent = e;
      const type = inputEvent.inputType;
      if (type === "insertFromDictation" || type === "insertFromVoice" || // Some browsers report dictation as insertReplacementText
      // but only flag it if it inserts a lot of text at once (>50 chars)
      type === "insertReplacementText" && inputEvent.data && inputEvent.data.length > 50) {
        e.preventDefault();
        addViolation("voice_input");
      }
    }
    function handlePipEnter() {
      addViolation("pip_detected");
    }
    function handleFocus() {
      if (countdownIntervalRef.current) {
        clearCountdown();
      }
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("dragend", handleDragEnd);
    document.addEventListener("drop", handleDrop);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("beforeinput", handleBeforeInput);
    document.addEventListener("enterpictureinpicture", handlePipEnter, true);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("dragend", handleDragEnd);
      document.removeEventListener("drop", handleDrop);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("beforeinput", handleBeforeInput);
      document.removeEventListener("enterpictureinpicture", handlePipEnter, true);
      if (pendingFsExitTimerRef.current) {
        clearTimeout(pendingFsExitTimerRef.current);
        pendingFsExitTimerRef.current = null;
      }
    };
  }, [enabled, addViolation, startCountdown, clearCountdown]);
  (0, import_react.useEffect)(() => {
    if (!enabled) return;
    const EXTENSION_SIGNATURES = [
      "grammarly",
      "schoolai",
      "quillbot",
      "languagetool",
      "ginger",
      "writefull",
      "wordtune",
      "prowritingaid",
      "hemingway",
      "copyleaks",
      "jenni",
      "jasper",
      "textblaze",
      "compose-ai",
      "hyperwrite",
      "otter-ai",
      "fireflies"
    ];
    function isExtensionElement(el) {
      if (el.tagName === "IFRAME") {
        const src = el.getAttribute("src") || "";
        if (/^(chrome|moz)-extension:\/\//i.test(src)) return true;
        if (!src || src.startsWith("blob:")) {
          const id2 = el.id?.toLowerCase() || "";
          const cls2 = typeof el.className === "string" ? el.className.toLowerCase() : "";
          if (EXTENSION_SIGNATURES.some(
            (sig) => id2.includes(sig) || cls2.includes(sig)
          )) {
            return true;
          }
        }
      }
      if (el.shadowRoot && !el.hasAttribute("data-rcnr")) {
        return true;
      }
      const id = el.id?.toLowerCase() || "";
      const cls = typeof el.className === "string" ? el.className.toLowerCase() : "";
      for (const attr of el.getAttributeNames?.() || []) {
        const attrLower = attr.toLowerCase();
        if (EXTENSION_SIGNATURES.some((sig) => attrLower.includes(sig))) {
          return true;
        }
      }
      if (EXTENSION_SIGNATURES.some(
        (sig) => id.includes(sig) || cls.includes(sig)
      )) {
        return true;
      }
      if (el.parentElement === document.body && !el.hasAttribute("data-rcnr")) {
        const tag = el.tagName?.toLowerCase() || "";
        if (tag === "div" || tag === "section" || tag === "aside") {
          const style = window.getComputedStyle(el);
          if ((style.position === "fixed" || style.position === "absolute") && parseInt(style.width, 10) > 200) {
            const html = el.innerHTML?.toLowerCase() || "";
            if (/chrome-extension:|moz-extension:/i.test(html)) {
              return true;
            }
          }
        }
      }
      return false;
    }
    const observer = new MutationObserver((mutations) => {
      if (!hasEnteredFullscreenRef.current) return;
      if (graceRef.current) return;
      if (autoSubmittedRef.current) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (isExtensionElement(node)) {
            addViolation("extension_detected");
            return;
          }
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
    const scanTimer = requestAnimationFrame(() => {
      if (!hasEnteredFullscreenRef.current) return;
      const allElements = document.querySelectorAll("*");
      for (const el of allElements) {
        if (isExtensionElement(el)) {
          addViolation("extension_detected");
          break;
        }
      }
    });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(scanTimer);
    };
  }, [enabled, addViolation]);
  (0, import_react.useEffect)(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      if (!hasEnteredFullscreenRef.current) return;
      if (graceRef.current) return;
      if (autoSubmittedRef.current) return;
      if (!document.hasFocus()) {
        const now = Date.now();
        if (now - lastFocusPollViolationRef.current < FOCUS_POLL_COOLDOWN_MS)
          return;
        if (now - lastFsExitRef.current < BLUR_SUPPRESS_AFTER_FS_EXIT_MS)
          return;
        if (pendingFsExitTimerRef.current) return;
        lastFocusPollViolationRef.current = now;
        addViolation("window_blur");
      }
    }, FOCUS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, addViolation]);
  return {
    isFullscreen,
    isMobileDevice,
    violations,
    warning,
    fullscreenCountdown,
    strikesRemaining,
    hasEnteredFullscreen,
    enterFullscreen
  };
}

// src/components/ResumeBanner.tsx
var import_react2 = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
function ResumeBanner({
  visible,
  keystrokeCount = 0,
  priorViolationCount = 0,
  autoDismissMs = 1e4,
  headline = "Your teacher let you back in.",
  body = "Continue where you left off.",
  className = "",
  onDismiss
}) {
  const [dismissed, setDismissed] = (0, import_react2.useState)(false);
  (0, import_react2.useEffect)(() => {
    if (!visible || dismissed || autoDismissMs <= 0) return;
    const t = setTimeout(() => {
      setDismissed(true);
      onDismiss?.();
    }, autoDismissMs);
    return () => clearTimeout(t);
  }, [visible, dismissed, autoDismissMs, onDismiss]);
  (0, import_react2.useEffect)(() => {
    if (!visible || dismissed) return;
    if (keystrokeCount > 0) {
      setDismissed(true);
      onDismiss?.();
    }
  }, [visible, dismissed, keystrokeCount, onDismiss]);
  if (!visible || dismissed) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "div",
    {
      className: `px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/30 flex items-center justify-between shrink-0 ${className}`,
      role: "status",
      "aria-live": "polite",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "text-sm text-emerald-200", children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "font-semibold", children: headline }),
          " ",
          body,
          priorViolationCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "text-fg-dim ml-2", children: [
            "(",
            priorViolationCount,
            " violation",
            priorViolationCount === 1 ? "" : "s",
            " from your earlier session were preserved.)"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            onClick: () => {
              setDismissed(true);
              onDismiss?.();
            },
            className: "text-emerald-200/60 hover:text-emerald-200 text-sm shrink-0 ml-3",
            "aria-label": "Dismiss banner",
            children: "Dismiss"
          }
        )
      ]
    }
  );
}

// src/components/ViolationLogPreview.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function ViolationLogPreview({
  violations,
  tabSwitchCount = 0,
  headline = "Lockdown activity",
  className = "",
  formatType = (t) => t
}) {
  const violationCount = violations.length;
  if (tabSwitchCount === 0 && violationCount === 0) return null;
  const latestRawType = violationCount > 0 ? violations[violationCount - 1]?.type ?? "unknown" : null;
  const latestType = latestRawType !== null ? formatType(latestRawType) : null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    "div",
    {
      className: `p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 ${className}`,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "text-xs font-semibold text-amber-300 uppercase tracking-wide mb-2", children: headline }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("ul", { className: "text-xs text-fg-muted space-y-1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-amber-200 font-medium", children: tabSwitchCount }),
            " ",
            "tab switch",
            tabSwitchCount === 1 ? "" : "es"
          ] }),
          violationCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-amber-200 font-medium", children: violationCount }),
            " ",
            "logged violation",
            violationCount === 1 ? "" : "s"
          ] }),
          latestType && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { className: "pt-1 mt-1 border-t border-amber-500/20", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-fg-dim", children: "Latest:" }),
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "text-fg-muted", children: latestType })
          ] })
        ] })
      ]
    }
  );
}

// src/components/ResetAccessConfirm.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function ResetAccessConfirm({
  mode,
  studentName,
  unitLabel,
  hasLaterUnits = false,
  violations = [],
  tabSwitchCount = 0,
  formatViolationType,
  submitting = false,
  errorMessage = null,
  resumeHeading,
  restartHeading,
  resumeBody,
  restartBody,
  resumeConfirmLabel,
  restartConfirmLabel,
  onConfirm,
  onCancel
}) {
  if (mode === null) return null;
  const isResume = mode === "resume";
  const heading = isResume ? resumeHeading ?? `Let ${studentName} continue ${unitLabel}?` : restartHeading ?? `Reset ${studentName}'s ${unitLabel}?`;
  const body = isResume ? resumeBody ?? "Their prior text and any lockdown violations are preserved. They'll rejoin with the same access code and pick up where they left off." : restartBody ?? `This deletes their ${unitLabel}${hasLaterUnits ? " and any later units" : ""}. Earlier work is preserved. They'll rejoin with the same access code and start ${unitLabel} from scratch.`;
  const confirmLabel = isResume ? resumeConfirmLabel ?? "Resume student" : restartConfirmLabel ?? "Start over";
  const confirmClasses = isResume ? "px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50" : "px-4 py-2 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition-colors disabled:opacity-50";
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      className: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "reset-access-heading",
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "rcnr-card-flat p-6 max-w-lg w-full", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "h2",
          {
            id: "reset-access-heading",
            className: "text-lg font-semibold text-fg mb-2",
            children: heading
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "text-sm text-fg-muted mb-4", children: body }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          ViolationLogPreview,
          {
            violations,
            tabSwitchCount,
            formatType: formatViolationType,
            className: "mb-4"
          }
        ),
        errorMessage && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "text-sm text-red-300 mb-3", children: errorMessage }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "flex items-center justify-end gap-2 pt-2", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              onClick: onCancel,
              disabled: submitting,
              className: "px-3 py-2 text-sm font-medium text-fg-muted rounded-lg hover:bg-brand/5 transition-colors disabled:opacity-50",
              children: "Cancel"
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              onClick: onConfirm,
              disabled: submitting,
              className: confirmClasses,
              children: submitting ? "Working..." : confirmLabel
            }
          )
        ] })
      ] })
    }
  );
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  INSTANT_SUBMIT_VIOLATIONS,
  ResetAccessConfirm,
  ResumeBanner,
  ViolationLogPreview,
  useLockdown
});
