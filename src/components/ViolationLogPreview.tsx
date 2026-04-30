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

import * as React from "react";

export interface ViolationLogPreviewProps {
  /** All violations recorded for this draft / submission. Accepts
   *  both `Violation` from useLockdown (where `type` is a known
   *  `ViolationType`) and backend-decoded arrays where `type` is an
   *  arbitrary string. The component only reads `.type`. */
  violations: ReadonlyArray<{ type: string }>;
  /** Tab switch count (separate field on most backend models). */
  tabSwitchCount?: number;
  /** Headline shown above the list. Default: "Lockdown activity". */
  headline?: string;
  /** Optional className for the outer container. */
  className?: string;
}

export function ViolationLogPreview({
  violations,
  tabSwitchCount = 0,
  headline = "Lockdown activity",
  className = "",
}: ViolationLogPreviewProps): React.JSX.Element | null {
  const violationCount = violations.length;
  if (tabSwitchCount === 0 && violationCount === 0) return null;

  const latestType =
    violationCount > 0 ? violations[violationCount - 1]?.type ?? "unknown" : null;

  return (
    <div
      className={`p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 ${className}`}
    >
      <p className="text-xs font-semibold text-amber-300 uppercase tracking-wide mb-2">
        {headline}
      </p>
      <ul className="text-xs text-fg-muted space-y-1">
        <li>
          <span className="text-amber-200 font-medium">{tabSwitchCount}</span>{" "}
          tab switch{tabSwitchCount === 1 ? "" : "es"}
        </li>
        {violationCount > 0 && (
          <li>
            <span className="text-amber-200 font-medium">{violationCount}</span>{" "}
            logged violation{violationCount === 1 ? "" : "s"}
          </li>
        )}
        {latestType && (
          <li className="pt-1 mt-1 border-t border-amber-500/20">
            <span className="text-fg-dim">Latest:</span>{" "}
            <span className="text-fg-muted">{latestType}</span>
          </li>
        )}
      </ul>
    </div>
  );
}
