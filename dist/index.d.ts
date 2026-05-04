import * as React from 'react';

/** A recorded lockdown violation. */
interface Violation {
    type: ViolationType;
    timestamp: number;
    /** Diagnostic snapshot at the moment the violation fired. Optional for
     *  backwards compatibility — older lockdown versions and tests may emit
     *  bare {type, timestamp} entries. Added in v1.7.1 to ground-truth what
     *  the OS / browser state was when the violation triggered, so we can
     *  tell "OS popup stole focus" from "kid alt-tabbed away" in post-hoc
     *  analysis without needing to repro on a dev machine. */
    context?: ViolationContext;
}
/** Diagnostic context captured at violation time. All fields are optional
 *  — collection can fail silently (browser API unavailable, sandbox
 *  restrictions) without dropping the violation itself. */
interface ViolationContext {
    /** document.visibilityState at violation time. */
    visibilityState?: DocumentVisibilityState;
    /** document.hasFocus() at violation time. */
    hasFocus?: boolean;
    /** Whether document.fullscreenElement was set at violation time. */
    isFullscreen?: boolean;
    /** Strike count at violation time (after the strike was burned, if applicable). */
    strikesRemaining?: number;
    /** Whether a fullscreen-exit grace timer was pending at violation time
     *  — if true and the violation is fullscreen_exit/window_blur/tab_switch,
     *  the grace window probably eliminated this strike (v1.7.0+). */
    fsExitGracePending?: boolean;
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
 * 3-STRIKE LIMIT (any focus loss):
 *   fullscreen_exit, window_blur (Alt+Tab, Win key, Ctrl+N), tab_switch
 *   ALL burn a strike. After 3 strikes, the next violation auto-submits.
 *   Fullscreen exits start a 5-second wall-clock countdown to re-enter.
 *
 * OS-INDUCED EXIT GRACE WINDOW (1500ms):
 *   When fullscreen exits, a 1.5-second timer waits to see if focus
 *   returns and we re-enter fullscreen. If yes, the exit was OS-induced
 *   (Windows Update popup, Sticky Keys notification, antivirus prompt
 *   that auto-dismissed) — show a non-counting warning instead of
 *   burning a strike. If we're still out of fullscreen at 1500ms, the
 *   exit was genuine — burn the strike normally.
 *
 * FOCUS POLLING HEARTBEAT (500ms):
 *   document.hasFocus() is checked every 500ms as a safety net.
 *   This catches OS-level actions (Win key, Alt+Tab, notifications)
 *   that don't reliably fire browser blur/visibility events on Windows.
 *   Suppressed while a fullscreen-exit grace timer is pending so a
 *   single OS event doesn't burn two strikes in parallel.
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

/**
 * ResumeBanner — student-facing UI shown after a teacher hits Resume
 * on a kicked / submitted student.
 *
 * Behavior:
 *   - Renders an emerald-tinted banner above the writing surface.
 *   - Auto-dismisses after `autoDismissMs` (default 10s) OR on the
 *     first keystroke detected via the `keystrokeCount` prop —
 *     whichever comes first.
 *   - The student can also manually dismiss via the "Dismiss" button.
 *
 * Design goal: identical UX across every lockdown-enabled student
 * frontend (Blue Book, Draft Coach, ProveIt, TestHub, ...). The
 * banner copy and visual tone are deliberately uniform — students
 * recognize the same "your teacher let you back in" affordance no
 * matter which RCNR tool they're using.
 *
 * Usage:
 *   <ResumeBanner
 *     visible={resumedByTeacher}
 *     keystrokeCount={keystrokeCount}
 *     priorViolationCount={priorViolationCount}
 *   />
 */

interface ResumeBannerProps {
    /** Whether the banner should be shown (controlled by the consumer). */
    visible: boolean;
    /** Total keystrokes since the writing session started. The banner
     *  auto-dismisses the first time this transitions from 0 to >0. */
    keystrokeCount?: number;
    /** Number of violations preserved from the prior session. If > 0,
     *  the banner adds a parenthetical telling the student their
     *  earlier violations were preserved. */
    priorViolationCount?: number;
    /** Auto-dismiss timeout in ms. Default 10_000. Pass 0 to disable. */
    autoDismissMs?: number;
    /** Optional override copy for the headline portion. */
    headline?: string;
    /** Optional override copy for the body portion (after the headline,
     *  before the violation parenthetical). When omitted, defaults to
     *  the summative-tool wording "Continue where you left off." */
    body?: string;
    /** Optional className for the outer container — appended after the
     *  default classes so consumers can tweak spacing or borders. */
    className?: string;
    /** Optional callback when the banner is dismissed (auto OR manual). */
    onDismiss?: () => void;
}
declare function ResumeBanner({ visible, keystrokeCount, priorViolationCount, autoDismissMs, headline, body, className, onDismiss, }: ResumeBannerProps): React.JSX.Element | null;

/**
 * ResetAccessConfirm — teacher-facing modal shown before letting a
 * student back into a session (Resume mode) or wiping their current
 * submission (Restart / Start Over mode).
 *
 * Surfaces the lockdown activity inline (via ViolationLogPreview) so
 * the teacher decides with full context. Robin's complaint on Blue
 * Book (commit 73f0d3c) was that without violation visibility, you
 * can't tell whether to Resume (kid had a glitch) or Start Over (kid
 * copy-pasted and should restart). This modal solves that for every
 * lockdown tool.
 *
 * Tool-agnostic: the consumer passes a `unitLabel` (e.g. "Draft 3",
 * "exam", "quiz") and copy adapts. The endpoint call is the
 * consumer's responsibility — this component only handles the
 * decision UX.
 *
 * Usage:
 *   <ResetAccessConfirm
 *     mode={resetMode}
 *     studentName={submission.student_name}
 *     unitLabel={`Draft ${currentDraft.draft_number}`}
 *     hasLaterUnits={drafts.length > current.draft_number}
 *     violations={currentDraft.violation_log}
 *     tabSwitchCount={currentDraft.tab_switch_count}
 *     submitting={resetSubmitting}
 *     errorMessage={resetError}
 *     onConfirm={() => handleResetAccess(resetMode)}
 *     onCancel={() => setResetMode(null)}
 *   />
 */

type ResetAccessMode = "resume" | "restart";
interface ResetAccessConfirmProps {
    /** When non-null, the modal renders. Pass null to hide. */
    mode: ResetAccessMode | null;
    /** Display name of the student being reset. */
    studentName: string;
    /** Label for the unit being reset — e.g. "Draft 3", "exam", "quiz".
     *  Appears in the modal heading + body. */
    unitLabel: string;
    /** Whether there are later units (e.g. drafts past the current one)
     *  that will also be deleted on Restart. Affects the body copy. */
    hasLaterUnits?: boolean;
    /** Violations preserved on the current unit. Shown via
     *  <ViolationLogPreview>. The component only reads `.type`. */
    violations?: ReadonlyArray<{
        type: string;
    }>;
    /** Tab switch count on the current unit. */
    tabSwitchCount?: number;
    /** Optional mapper for raw violation types -> human labels.
     *  Forwarded to <ViolationLogPreview>. */
    formatViolationType?: (type: string) => string;
    /** Whether a request is in flight — disables the confirm button. */
    submitting?: boolean;
    /** Error message from the most recent attempt. Shown inline. */
    errorMessage?: string | null;
    /** Optional copy overrides — let consumer tools speak in their own
     *  voice. Bluebook (summative) keeps the defaults; Draft Coach
     *  (formative / "the writing gym") passes coach-flavored copy.
     *  Each accepts the studentName / unitLabel-substituted final string. */
    resumeHeading?: string;
    restartHeading?: string;
    resumeBody?: string;
    restartBody?: string;
    resumeConfirmLabel?: string;
    restartConfirmLabel?: string;
    /** Called when the teacher confirms. */
    onConfirm: () => void;
    /** Called when the teacher cancels (X / Cancel / Esc). */
    onCancel: () => void;
}
declare function ResetAccessConfirm({ mode, studentName, unitLabel, hasLaterUnits, violations, tabSwitchCount, formatViolationType, submitting, errorMessage, resumeHeading, restartHeading, resumeBody, restartBody, resumeConfirmLabel, restartConfirmLabel, onConfirm, onCancel, }: ResetAccessConfirmProps): React.JSX.Element | null;

/**
 * ViolationLogPreview — small inline summary of lockdown violations.
 *
 * Used inside the ResetAccessConfirm modal AND any teacher detail
 * surface that wants a compact "what did the student do" callout.
 *
 * Renders an amber-tinted box with:
 *   - Tab switch count (always shown)
 *   - Total violation count (when > 0)
 *   - The most recent violation type (when violations array is non-empty)
 *
 * Returns null when there's nothing to report (no tab switches AND
 * no violations) so the consumer doesn't have to gate it.
 */

interface ViolationLogPreviewProps {
    /** All violations recorded for this draft / submission. Accepts
     *  both `Violation` from useLockdown (where `type` is a known
     *  `ViolationType`) and backend-decoded arrays where `type` is an
     *  arbitrary string. The component only reads `.type`. */
    violations: ReadonlyArray<{
        type: string;
    }>;
    /** Tab switch count (separate field on most backend models). */
    tabSwitchCount?: number;
    /** Headline shown above the list. Default: "Lockdown activity". */
    headline?: string;
    /** Optional className for the outer container. */
    className?: string;
    /** Optional mapper turning a raw violation type ("tab_switch") into
     *  a human-readable label ("Tab Switch"). Defaults to identity. */
    formatType?: (type: string) => string;
}
declare function ViolationLogPreview({ violations, tabSwitchCount, headline, className, formatType, }: ViolationLogPreviewProps): React.JSX.Element | null;

export { INSTANT_SUBMIT_VIOLATIONS, ResetAccessConfirm, type ResetAccessConfirmProps, type ResetAccessMode, ResumeBanner, type ResumeBannerProps, type UseLockdownOptions, type UseLockdownReturn, type Violation, ViolationLogPreview, type ViolationLogPreviewProps, type ViolationType, useLockdown };
