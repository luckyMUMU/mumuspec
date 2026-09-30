/**
 * Graph fact builders — the single adapter between repository state and the
 * renderers (core-consolidation L5, R-0019).
 *
 * Both the CLI (`mumuspec graph render`) and the MCP tool (`render_diagram`)
 * go through these functions. Two adapters would drift, and a drifting
 * projection is exactly the "checker vs builder diverge" defect class this
 * project forbids.
 *
 * Read-only: nothing here writes state or transitions a change.
 */

import { activateProjectWorkflow } from '../change/state-machine.js';
import { loadAllContracts } from '../contract/loader.js';
import { loadConfig } from '../core/config.js';
import { loadSpecContext } from '../spec/loader.js';
import type {
  ConstraintTreeInput,
  ContractGraphInput,
  WorkflowGraphInput,
} from './render.js';

export function buildWorkflowGraphInput(projectRoot: string, workflow = 'full'): WorkflowGraphInput {
  const config = activateProjectWorkflow(projectRoot).config;
  const declared = config.workflows[workflow as keyof typeof config.workflows];
  return {
    workflow,
    phases: declared?.phases ?? config.phases,
    terminal: config.terminal,
    edges: config.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      direction: edge.direction,
      countAs: edge.countAs,
      label: edge.label,
      bp: edge.bp,
    })),
    phaseBps: declared?.phase_bps as Record<string, string[]> | undefined,
  };
}

export function buildContractGraphInput(projectRoot: string): ContractGraphInput {
  const registry = loadAllContracts(projectRoot);
  return {
    contracts: registry.contracts.map((contract) => ({
      id: contract.id,
      name: contract.name,
      criticality: contract.criticality,
      upstream: contract.upstream ?? [],
      downstream: contract.downstream ?? [],
    })),
  };
}

export function buildConstraintTreeInput(projectRoot: string, targetPath = '.'): ConstraintTreeInput {
  const context = loadSpecContext(targetPath, projectRoot, loadConfig(projectRoot));
  return {
    layers: context.layers.map((layer) => ({
      level: layer.level,
      scope: layer.scope,
      inheritedFrom: layer.inherited_from ?? [],
      merged: layer.merged,
    })),
  };
}
