/**
 * Lockdown hook — enforces fullscreen environment for student tools.
 *
 * Two-tier violation policy:
 *
 * INSTANT SUBMIT (cheating attempts — never accidental):
 *   copy, cut, paste, external drop, devtools shortcuts
 *
 * 2-STRIKE LIMIT (any focus loss):
 *   fullscreen_exit, window_blur (Alt+Tab, Win key, Ctrl+N), tab_switch
 *   ALL burn a strike. After 2 strikes, the next violation auto-submits.
 *   Fullscreen exits start a 5-second wall-clock countdown to re-enter.
 *
 * FOCUS POLLING HEARTBEAT (500ms):
 *   document.hasFocus() is checked every 500ms as a safety net.
 *   This catches OS-level actions (Win key, Alt+Tab, notifications)
 *   that don't reliably fire browser blur/visibility events on Windows.
 *
 * The countdown uses wall-clock timestamps (Date.now()) so freezing
 * JS execution (e.g. via browser task manager) cannot buy extra time.
 *
 * Also blocked (no violation, just prevented):
 *   view source (Ctrl/Cmd+U), print (Ctrl/Cmd+P), context menu (right-click),
 *   Ctrl/Cmd+N (new window), Alt+Tab, Meta/Win key
 *
 * Philosophy: brutally simple. Not Proctorio. Just honest guardrails.
 * If a student makes an honest mistake, the teacher can reset their access.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  UseLockdownOptions,
  UseLockdownReturn,
  Violation,
  ViolationType,
} from "./types";
import { INSTANT_SUBMIT_VIOLATIONS } from "./types";

const DEFAULT_GRACE_PERIOD_MS = 5000;
const WARNING_DISPLAY_MS = 5000;
const DEVTOOLS_KEYS = ["I", "J", "C", "K"]; // K = Firefox console
/** After a fullscreen exit, suppress blur violations for this window (ms). */
const BLUR_SUPPRESS_AFTER_FS_EXIT_MS = 500;
/** Seconds the student has to re-enter fullscreen before auto-submit. */
const FULLSCREEN_REENTRY_SECONDS = 5;
/** Maximum fullscreen exits before auto-submit. */
const MAX_FULLSCREEN_EXITS = 2;
/** How often (ms) to poll document.hasFocus() as a safety net. */
const FOCUS_POLL_INTERVAL_MS = 500;
/**
 * After detecting a focus loss via polling, suppress duplicate poll detections
 * for this window (ms) so a single Alt+Tab doesn't fire 10 violations.
 */
const FOCUS_POLL_COOLDOWN_MS = 2000;

/** Detect mobile/tablet devices that cannot support fullscreen lockdown. */
function detectMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const hasTouch = navigator.maxTouchPoints > 0;
  const isSmallScreen = window.screen.width < 1024;
  const mobileUA =
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|Opera Mini|IEMobile/i.test(
      navigator.userAgent,
    );
  return mobileUA || (hasTouch && isSmallScreen);
}

export function useLockdown({
  enabled,
  gracePeriodMs = DEFAULT_GRACE_PERIOD_MS,
  onAutoSubmit,
  onViolation,
}: UseLockdownOptions): UseLockdownReturn {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [isMobileDevice] = useState(() => detectMobileDevice());
  const [fullscreenCountdown, setFullscreenCountdown] = useState<number | null>(
    null,
  );
  const [strikesRemaining, setStrikesRemaining] = useState(MAX_FULLSCREEN_EXITS);
  const [hasEnteredFullscreen, setHasEnteredFullscreen] = useState(false);

  const graceRef = useRef(false);
  const fullscreenExitCountRef = useRef(0);
  /** Timestamp of last fullscreen exit — used to suppress the blur that follows it. */
  const lastFsExitRef = useRef(0);
  /** Interval ID for the fullscreen re-entry countdown. */
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  /** Wall-clock timestamp when countdown started — prevents JS freeze exploits. */
  const countdownStartRef = useRef(0);
  /** Guard against calling onAutoSubmit more than once. */
  const autoSubmittedRef = useRef(false);
  /** Tracks whether a drag started inside the page (internal rearrange = OK). */
  const internalDragRef = useRef(false);
  /** Whether fullscreen has been entered at least once — no violations until then. */
  const hasEnteredFullscreenRef = useRef(false);
  /** Timestamp of last focus-loss detection from polling — prevents rapid-fire duplicates. */
  const lastFocusPollViolationRef = useRef(0);

  // Stable refs for callbacks so event handlers never capture stale versions.
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

  // --- Fullscreen countdown timer ---
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
      const elapsed = (Date.now() - countdownStartRef.current) / 1000;
      const remaining = Math.max(
        0,
        Math.ceil(FULLSCREEN_REENTRY_SECONDS - elapsed),
      );
      setFullscreenCountdown(remaining);
      if (remaining <= 0) {
        clearCountdown();
        triggerAutoSubmit();
      }
    }, 500); // Check every 500ms for smoother display + faster freeze detection
  }, [clearCountdown, triggerAutoSubmit]);

  // Clean up countdown on unmount
  useEffect(() => {
    return () => clearCountdown();
  }, [clearCountdown]);

  const addViolation = useCallback(
    (type: ViolationType) => {
      if (graceRef.current) return;
      // Don't track violations until the student has entered fullscreen at least once
      if (!hasEnteredFullscreenRef.current) return;
      // Don't accumulate violations after auto-submit has already fired
      if (autoSubmittedRef.current) return;

      const v: Violation = { type, timestamp: Date.now() };
      setViolations((prev) => [...prev, v]);
      onViolationRef.current?.(v);

      // Instant submit for cheating attempts
      if (INSTANT_SUBMIT_VIOLATIONS.has(type)) {
        setWarning("Your work has been submitted.");
        triggerAutoSubmit();
        return;
      }

      // fullscreen_exit, window_blur, and tab_switch all burn strikes.
      // Previously only fullscreen_exit counted — but Alt+Tab and Win key
      // bypass fullscreen events entirely on Windows, so students could
      // switch apps freely with zero consequences. Now any focus loss counts.
      if (
        type === "fullscreen_exit" ||
        type === "window_blur" ||
        type === "tab_switch"
      ) {
        fullscreenExitCountRef.current += 1;
        const remaining = MAX_FULLSCREEN_EXITS - fullscreenExitCountRef.current;
        setStrikesRemaining(remaining);

        if (remaining < 0) {
          // Out of strikes — instant submit, no countdown
          setWarning("Your work has been submitted.");
          triggerAutoSubmit();
        } else if (remaining === 0) {
          setWarning(
            "Final warning: leave this window again and your work will be auto-submitted.",
          );
          setTimeout(() => setWarning(null), WARNING_DISPLAY_MS);
        } else {
          setWarning(
            `Warning: you left the writing window. You have ${remaining} chance${remaining > 1 ? "s" : ""} left.`,
          );
          setTimeout(() => setWarning(null), WARNING_DISPLAY_MS);
        }
      }
    },
    [triggerAutoSubmit],
  );

  // Enter fullscreen — stable callback
  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
      clearCountdown();

      // Only grant grace period on the very first entry (not after violations)
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
      // Fullscreen not supported or denied — silently ignore.
      // Only start countdown if we've been in fullscreen before (= student left it).
      if (hasEnteredFullscreenRef.current) {
        startCountdown();
      }
    }
  }, [gracePeriodMs, clearCountdown, startCountdown]);

  // Beforeunload — prevent accidental tab close / navigation
  useEffect(() => {
    if (!enabled) return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Fullscreen change handler
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
        // Start countdown if they still have strikes remaining
        if (fullscreenExitCountRef.current <= MAX_FULLSCREEN_EXITS) {
          startCountdown();
        }
      }
    }

    // Visibility change (tab switch)
    // Suppressed while countdown is active — being outside fullscreen
    // naturally causes blur/visibility events; don't double-count.
    function handleVisibilityChange() {
      if (
        document.hidden &&
        !graceRef.current &&
        !countdownIntervalRef.current
      ) {
        addViolation("tab_switch");
      }
    }

    // Window blur (Alt+Tab, Win key, Ctrl+N, etc.)
    // Only suppressed briefly after a fullscreen exit (to avoid double-counting
    // the blur that naturally follows exiting fullscreen). NOT suppressed during
    // countdown — if a student Alt+Tabs during their 5-second window, that's
    // a real violation.
    function handleBlur() {
      if (graceRef.current) return;
      if (Date.now() - lastFsExitRef.current < BLUR_SUPPRESS_AFTER_FS_EXIT_MS)
        return;
      addViolation("window_blur");
    }

    // Block paste — instant submit
    function handlePaste(e: Event) {
      e.preventDefault();
      addViolation("paste_attempt");
    }

    // Block copy & cut — instant submit
    function handleCopy(e: Event) {
      e.preventDefault();
      addViolation("copy_attempt");
    }

    function handleCut(e: Event) {
      e.preventDefault();
      addViolation("cut_attempt");
    }

    // Drag/drop: allow internal rearranging, block external drops.
    function handleDragStart() {
      internalDragRef.current = true;
    }

    function handleDragEnd() {
      internalDragRef.current = false;
    }

    function handleDrop(e: DragEvent) {
      if (internalDragRef.current) {
        internalDragRef.current = false;
        return;
      }
      e.preventDefault();
      addViolation("drop_attempt");
    }

    function handleDragOver(e: DragEvent) {
      e.preventDefault();
    }

    // Block DevTools shortcuts (Ctrl AND Cmd for Mac support) — instant submit
    function handleKeydown(e: KeyboardEvent) {
      const modKey = e.ctrlKey || e.metaKey;

      // F12
      if (e.key === "F12") {
        e.preventDefault();
        addViolation("devtools_attempt");
        return;
      }
      // Ctrl/Cmd+Shift+I / J / C / K (K = Firefox console)
      if (
        modKey &&
        e.shiftKey &&
        DEVTOOLS_KEYS.includes(e.key.toUpperCase())
      ) {
        e.preventDefault();
        addViolation("devtools_attempt");
        return;
      }
      // Ctrl/Cmd+N (new window) — block and record violation
      if (modKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        addViolation("window_blur");
        return;
      }
      // Ctrl/Cmd+U (view source) — blocked silently, no violation
      if (modKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        return;
      }
      // Ctrl/Cmd+P (print) — blocked silently, no violation
      if (modKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        return;
      }
      // Alt+Tab — can't fully prevent OS-level switch, but record the attempt.
      // The actual app switch will also be caught by blur/focus polling.
      if (e.altKey && e.key === "Tab") {
        e.preventDefault();
        return;
      }
      // Meta/Win key alone — can't prevent OS start menu, but if we see the
      // keydown we can block default and log it. The actual focus loss is
      // caught by blur handler + focus polling.
      if (e.key === "Meta" || e.key === "OS") {
        e.preventDefault();
        return;
      }
    }

    // Block context menu (right-click)
    function handleContextMenu(e: MouseEvent) {
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

  // --- Focus polling heartbeat ---
  // The nuclear option: check every 500ms whether the window still has focus.
  // This catches EVERYTHING that browser events miss — Windows key overlays,
  // Alt+Tab on some browsers, OS-level notifications stealing focus, etc.
  // Without this, the lockdown is trivially bypassable on Windows.
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      if (!hasEnteredFullscreenRef.current) return;
      if (graceRef.current) return;
      if (autoSubmittedRef.current) return;

      if (!document.hasFocus()) {
        const now = Date.now();
        // Suppress if we already fired a focus-poll violation recently
        if (now - lastFocusPollViolationRef.current < FOCUS_POLL_COOLDOWN_MS)
          return;
        // Suppress if this is immediately after a fullscreen exit (blur handler covers it)
        if (now - lastFsExitRef.current < BLUR_SUPPRESS_AFTER_FS_EXIT_MS)
          return;
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
    enterFullscreen,
  };
}
