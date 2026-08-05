/**
 * Loop Grill Types — Type definitions for loop grill-me validation
 */

/** A grill question used to validate loop parameters */
export interface LoopGrillQuestion {
  /** Question identifier */
  id: string;
  /** The question text (presented to user in grill-me style) */
  question: string;
  /** Validation function — returns true if passes */
  check: (ctx: { goal: string; criteria: string[]; maxRounds: number }) => boolean;
  /** Warning message when check fails */
  warning: string;
  /** Suggested improvement */
  suggestion?: string;
}
