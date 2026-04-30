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

import * as React from "react";
import type { Violation } from "../types";
import { ViolationLogPreview } from "./ViolationLogPreview";

export type ResetAccessMode = "resume" | "restart";

export interface ResetAccessConfirmProps {
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
   *  <ViolationLogPreview>. */
  violations?: ReadonlyArray<Pick<Violation, "type">>;
  /** Tab switch count on the current unit. */
  tabSwitchCount?: number;
  /** Whether a request is in flight — disables the confirm button. */
  submitting?: boolean;
  /** Error message from the most recent attempt. Shown inline. */
  errorMessage?: string | null;
  /** Called when the teacher confirms. */
  onConfirm: () => void;
  /** Called when the teacher cancels (X / Cancel / Esc). */
  onCancel: () => void;
}

export function ResetAccessConfirm({
  mode,
  studentName,
  unitLabel,
  hasLaterUnits = false,
  violations = [],
  tabSwitchCount = 0,
  submitting = false,
  errorMessage = null,
  onConfirm,
  onCancel,
}: ResetAccessConfirmProps): React.JSX.Element | null {
  if (mode === null) return null;

  const isResume = mode === "resume";

  const heading = isResume
    ? `Let ${studentName} continue ${unitLabel}?`
    : `Reset ${studentName}'s ${unitLabel}?`;

  const body = isResume
    ? "Their prior text and any lockdown violations are preserved. They'll rejoin with the same access code and pick up where they left off."
    : `This deletes their ${unitLabel}${
        hasLaterUnits ? " and any later units" : ""
      }. Earlier work is preserved. They'll rejoin with the same access code and start ${unitLabel} from scratch.`;

  const confirmLabel = isResume ? "Resume student" : "Start over";
  const confirmClasses = isResume
    ? "px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
    : "px-4 py-2 text-sm font-medium rounded-lg bg-amber-600 text-white hover:bg-amber-500 transition-colors disabled:opacity-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-access-heading"
    >
      <div className="rcnr-card-flat p-6 max-w-lg w-full">
        <h2
          id="reset-access-heading"
          className="text-lg font-semibold text-fg mb-2"
        >
          {heading}
        </h2>
        <p className="text-sm text-fg-muted mb-4">{body}</p>

        <ViolationLogPreview
          violations={violations}
          tabSwitchCount={tabSwitchCount}
          className="mb-4"
        />

        {errorMessage && (
          <p className="text-sm text-red-300 mb-3">{errorMessage}</p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-3 py-2 text-sm font-medium text-fg-muted rounded-lg hover:bg-brand/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={confirmClasses}
          >
            {submitting ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
