/**
 * Phase Compressor — LLM Freedom Enhancement (L2 Conditional Autonomy)
 *
 * Determines whether a change's workflow can be compressed (full → tweak/hotfix)
 * based on scope signals and safety fence rules.
 *
 * Safety fence (hard block): cross_module, new_public_api, new_external_dep, data_migration
 * Risk gates: >4 files or >2 modules → no compression allowed
 */

import type { ChangeState, CompressionResult, Workflow } from './types-workflow.js';

/**
 * Evaluate whether phase compression is allowed for the given change state.
 *
 * L2 rule: compression is auto-approved only within safety fence boundaries.
 * Any fence trigger or elevated risk → compression denied.
 */
export function canCompress(state: ChangeState): CompressionResult {
  const blocking: string[] = [];

  // ── Safety fence (hard block — never compress) ──
  if (state.cross_module) blocking.push('cross_module');
  if (state.new_public_api) blocking.push('new_public_api');
  if (state.new_external_dep) blocking.push('new_external_dep');
  if (state.data_migration) blocking.push('data_migration');

  if (blocking.length > 0) {
    return {
      allowed: false,
      reason: `Safety fence active: ${blocking.join(', ')}. Full workflow required.`,
      blocking_conditions: blocking,
    };
  }

  const estimatedFiles = state.estimated_files ?? 0;
  const modulesAffected = state.modules_affected ?? 1;

  // ── Doc-only bypass: skip size gates (no build/verify needed) ──
  if (state.is_doc_only) {
    return {
      allowed: true,
      reason: `Documentation-only change. Tweak path sufficient.`,
      compressed_path: 'tweak',
    };
  }

  // ── Risk gates (soft block — too large to compress safely) ──
  if (estimatedFiles > 4) {
    return {
      allowed: false,
      reason: `Too many files (${estimatedFiles}) for safe compression. Full workflow recommended.`,
      blocking_conditions: ['estimated_files_exceeds_threshold'],
    };
  }

  if (modulesAffected > 2) {
    return {
      allowed: false,
      reason: `Too many modules affected (${modulesAffected}) for safe compression.`,
      blocking_conditions: ['modules_affected_exceeds_threshold'],
    };
  }

  // ── Determine compressed path ──
  let compressedPath: Workflow = 'tweak';
  if (state.is_pure_bugfix && estimatedFiles <= 2) {
    compressedPath = 'hotfix';
  }

  return {
    allowed: true,
    reason: `Change within safe compression bounds (${estimatedFiles} files, ${modulesAffected} modules).`,
    compressed_path: compressedPath,
  };
}
