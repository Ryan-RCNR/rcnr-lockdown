export { useLockdown } from "./useLockdown";
export type {
  Violation,
  ViolationType,
  UseLockdownOptions,
  UseLockdownReturn,
} from "./types";
export { INSTANT_SUBMIT_VIOLATIONS } from "./types";

// Shared lockdown UX components — added v1.5.0 (2026-04-30).
// See STATUS-rcnrlockdown.md for the canonical contract these
// components implement (Resume / Start Over flow + rehydrate banner).
export {
  ResumeBanner,
  ResetAccessConfirm,
  ViolationLogPreview,
} from "./components";
export type {
  ResumeBannerProps,
  ResetAccessConfirmProps,
  ResetAccessMode,
  ViolationLogPreviewProps,
} from "./components";
