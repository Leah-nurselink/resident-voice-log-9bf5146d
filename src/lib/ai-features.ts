/**
 * Switches for optional AI features.
 *
 * Keep a feature `false` until it has been through clinical safety review
 * (DCB0129) and the data-protection checks. Set it to `true` to show it.
 */
export const AI_FEATURES = {
  /** "Ask AI for a deeper safety review" button on the medication screen. */
  medicationSafetyReview: false,
} as const;
