/**
 * Chat domain types for OnboardChat.
 */

export type Role = 'new-member' | 'lead' | 'solo' | null;

export type MessageSender = 'user' | 'assistant' | 'system-progress';

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  mentionNodeIds?: string[];
  options?: ChatOption[];
  timestamp: string; // ISO
}

export interface ChatOption {
  label: string;
  nextStepId?: string;
  focusNodeId?: string;
}
