/** A recorded lockdown violation. */
interface Violation {
    type: ViolationType;
    timestamp: number;
}
/** All violation types the lockdown hook can detect. */
type ViolationType = "fullscreen_exit" | "tab_switch" | "window_blur" | "paste_attempt" | "copy_attempt" | "cut_attempt" | "drop_attempt" | "devtools_attempt" | "extension_detected" | "voice_input" | "pip_detected";
/** Violations that trigger instant auto-submit (cheating attempts). */
declare const INSTANT_SUBMIT_VIOLATIONS: Set<ViolationType>;
/** Configuration for the lockdown hook. */
interface UseLockdownOptions {
    /** Whether lockdown enforcement is active. */
    enabled: boolean;
    /** Grace period in ms after initial fullscreen entry. Default: 5000. */
    gracePeriodMs?: number;
    /** Called when auto-submit is triggered (cheating or strikes exhausted). */
    onAutoSubmit: () => void;
    /** Optional callback fired on every violation (e.g. for backend reporting). */
    onViolation?: (violation: Violation) => void;
}
/** Return value from the lockdown hook. */
interface UseLockdownReturn {
    /** Whether the browser is currently in fullscreen mode. */
    isFullscreen: boolean;
    /** Whether the device is mobile/tablet (cannot support fullscreen lockdown). */
    isMobileDevice: boolean;
    /** All recorded violations. */
    violations: Violation[];
    /** Current warning message, or null. */
    warning: string | null;
    /** Seconds remaining to re-enter fullscreen, or null if in fullscreen. */
    fullscreenCountdown: number | null;
    /** How many fullscreen exits remain before auto-submit. */
    strikesRemaining: number;
    /** Whether fullscreen has been entered at least once. */
    hasEnteredFullscreen: boolean;
    /** Request fullscreen entry. */
    enterFullscreen: () => Promise<void>;
}

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

declare function useLockdown({ enabled, gracePeriodMs, onAutoSubmit, onViolation, }: UseLockdownOptions): UseLockdownReturn;

export { INSTANT_SUBMIT_VIOLATIONS, type UseLockdownOptions, type UseLockdownReturn, type Violation, type ViolationType, useLockdown };
