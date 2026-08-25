/**
 * Onboard flow domain types.
 */

import type { Role } from './chat';

export interface OnboardStep {
  id: string;
  role: Role;
  prompt: string;
  options?: OnboardOption[];
  terminal?: boolean;
}

export interface OnboardOption {
  label: string;
  next: string;
  focusNodeId?: string;
}

export type OnboardProgress = Record<string, number>; // role → step index
