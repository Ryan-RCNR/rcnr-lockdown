// src/useLockdown.ts
import { useCallback, useEffect, useRef, useState } from "react";

// src/types.ts
var INSTANT_SUBMIT_VIOLATIONS = /* @__PURE__ */ new Set([
  "paste_attempt",
  "copy_attempt",
  "cut_attempt",
  "drop_attempt",
  "devtools_attempt"
]);

// src/useLockdown.ts
var DEFAULT_GRACE_PERIOD_MS = 5e3;
var WARNING_DISPLAY_MS = 5e3;
var DEVTOOLS_KEYS = ["I", "J", "C", "K"];
var BLUR_SUPPRESS_AFTER_FS_EXIT_MS = 500;
var FULLSCREEN_REENTRY_SECONDS = 5;
var MAX_FULLSCREEN_EXITS = 2;
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violations, setViolations] = useState([]);
  const [warning, setWarning] = useState(null);
  const [isMobileDevice] = useState(() => detectMobileDevice());
  const [fullscreenCountdown, setFullscreenCountdown] = useState(
    null
  );
  const [strikesRemaining, setStrikesRemaining] = useState(MAX_FULLSCREEN_EXITS);
  const [hasEnteredFullscreen, setHasEnteredFullscreen] = useState(false);
  const graceRef = useRef(false);
  const fullscreenExitCountRef = useRef(0);
  const lastFsExitRef = useRef(0);
  const countdownIntervalRef = useRef(
    null
  );
  const countdownStartRef = useRef(0);
  const autoSubmittedRef = useRef(false);
  const internalDragRef = useRef(false);
  const hasEnteredFullscreenRef = useRef(false);
  const onAutoSubmitRef = useRef(onAutoSubmit);
  useEffect(() => {
    onAutoSubmitRef.current = onAutoSubmit;
  }, [onAutoSubmit]);
  const onViolationRef = useRef(onViolation);
  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);
  const triggerAutoSubmit = useCallback(() => {
    if (autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    onAutoSubmitRef.current();
  }, []);
  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    countdownStartRef.current = 0;
    setFullscreenCountdown(null);
  }, []);
  const startCountdown = useCallback(() => {
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
  useEffect(() => {
    return () => clearCountdown();
  }, [clearCountdown]);
  const addViolation = useCallback(
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
      if (type === "fullscreen_exit") {
        fullscreenExitCountRef.current += 1;
        const remaining = MAX_FULLSCREEN_EXITS - fullscreenExitCountRef.current;
        setStrikesRemaining(remaining);
        if (remaining < 0) {
          setWarning("Your work has been submitted.");
          triggerAutoSubmit();
        } else if (remaining === 0) {
          setWarning(
            "Final warning: leave fullscreen again and your work will be auto-submitted."
          );
          setTimeout(() => setWarning(null), WARNING_DISPLAY_MS);
        } else {
          setWarning(
            `Warning: you have ${remaining} chance${remaining > 1 ? "s" : ""} left to re-enter fullscreen.`
          );
          setTimeout(() => setWarning(null), WARNING_DISPLAY_MS);
        }
      }
    },
    [triggerAutoSubmit]
  );
  const enterFullscreen = useCallback(async () => {
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
  useEffect(() => {
    if (!enabled) return;
    function handleBeforeUnload(e) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    function handleFullscreenChange() {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (fs) {
        hasEnteredFullscreenRef.current = true;
        setHasEnteredFullscreen(true);
        clearCountdown();
      } else if (!graceRef.current && hasEnteredFullscreenRef.current) {
        lastFsExitRef.current = Date.now();
        addViolation("fullscreen_exit");
        if (fullscreenExitCountRef.current <= MAX_FULLSCREEN_EXITS) {
          startCountdown();
        }
      }
    }
    function handleVisibilityChange() {
      if (document.hidden && !graceRef.current && !countdownIntervalRef.current) {
        addViolation("tab_switch");
      }
    }
    function handleBlur() {
      if (graceRef.current) return;
      if (countdownIntervalRef.current) return;
      if (Date.now() - lastFsExitRef.current < BLUR_SUPPRESS_AFTER_FS_EXIT_MS)
        return;
      addViolation("window_blur");
    }
    function handlePaste(e) {
      e.preventDefault();
      addViolation("paste_attempt");
    }
    function handleCopy(e) {
      e.preventDefault();
      addViolation("copy_attempt");
    }
    function handleCut(e) {
      e.preventDefault();
      addViolation("cut_attempt");
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
      if (modKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        return;
      }
      if (modKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        return;
      }
    }
    function handleContextMenu(e) {
      e.preventDefault();
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("cut", handleCut);
    document.addEventListener("dragstart", handleDragStart);
    document.addEventListener("dragend", handleDragEnd);
    document.addEventListener("drop", handleDrop);
    document.addEventListener("dragover", handleDragOver);
    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("contextmenu", handleContextMenu);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("cut", handleCut);
      document.removeEventListener("dragstart", handleDragStart);
      document.removeEventListener("dragend", handleDragEnd);
      document.removeEventListener("drop", handleDrop);
      document.removeEventListener("dragover", handleDragOver);
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [enabled, addViolation, startCountdown, clearCountdown]);
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
export {
  INSTANT_SUBMIT_VIOLATIONS,
  useLockdown
};
