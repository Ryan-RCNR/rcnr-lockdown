/** A recorded lockdown violation. */
export interface Violation {
  type: ViolationType;
  timestamp: number;
}

/** All violation types the lockdown hook can detect. */
export type ViolationType =
  | "fullscreen_exit"
  | "tab_switch"
  | "window_blur"
  | "paste_attempt"
  | "copy_attempt"
  | "cut_attempt"
  | "drop_attempt"
  | "devtools_attempt"
  | "extension_detected"
  | "voice_input"
  | "pip_detected";

/** Violations that trigger instant auto-submit (cheating attempts). */
export const INSTANT_SUBMIT_VIOLATIONS = new Set<ViolationType>([
  "paste_attempt",
  "copy_attempt",
  "cut_attempt",
  "drop_attempt",
  "devtools_attempt",
  "extension_detected",
  "voice_input",
  "pip_detected",
]);

/** Configuration for the lockdown hook. */
export interface UseLockdownOptions {
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
export interface UseLockdownReturn {
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
