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

import * as React from "react";
import { useEffect, useState } from "react";

export interface ResumeBannerProps {
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
  /** Optional className for the outer container — appended after the
   *  default classes so consumers can tweak spacing or borders. */
  className?: string;
  /** Optional callback when the banner is dismissed (auto OR manual). */
  onDismiss?: () => void;
}

export function ResumeBanner({
  visible,
  keystrokeCount = 0,
  priorViolationCount = 0,
  autoDismissMs = 10_000,
  headline = "Your teacher let you back in.",
  className = "",
  onDismiss,
}: ResumeBannerProps): React.JSX.Element | null {
  const [dismissed, setDismissed] = useState(false);

  // Auto-dismiss after timeout
  useEffect(() => {
    if (!visible || dismissed || autoDismissMs <= 0) return;
    const t = setTimeout(() => {
      setDismissed(true);
      onDismiss?.();
    }, autoDismissMs);
    return () => clearTimeout(t);
  }, [visible, dismissed, autoDismissMs, onDismiss]);

  // Auto-dismiss on first keystroke
  useEffect(() => {
    if (!visible || dismissed) return;
    if (keystrokeCount > 0) {
      setDismissed(true);
      onDismiss?.();
    }
  }, [visible, dismissed, keystrokeCount, onDismiss]);

  if (!visible || dismissed) return null;

  return (
    <div
      className={`px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/30 flex items-center justify-between shrink-0 ${className}`}
      role="status"
      aria-live="polite"
    >
      <p className="text-sm text-emerald-200">
        <span className="font-semibold">{headline}</span>{" "}
        Continue where you left off.
        {priorViolationCount > 0 && (
          <span className="text-fg-dim ml-2">
            ({priorViolationCount} violation
            {priorViolationCount === 1 ? "" : "s"} from your earlier session
            were preserved.)
          </span>
        )}
      </p>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          onDismiss?.();
        }}
        className="text-emerald-200/60 hover:text-emerald-200 text-sm shrink-0 ml-3"
        aria-label="Dismiss banner"
      >
        Dismiss
      </button>
    </div>
  );
}
