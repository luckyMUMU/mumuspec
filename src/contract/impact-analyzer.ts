/**
 * Contract Impact Analyzer — analyzes the upstream/downstream impact of
 * proposed contract changes.
 *
 * Implements AGENTS.md Step 1 of External Contract Changes:
 * "逐一列出所有上游/下游依赖方、兼容性风险、breaking change 风险"
 */

import type {
  Contract,
  ContractRegistry,
  ContractImpactAnalysis,
  ImpactEntry,
} from '../core/types-contract.js';
import { loadAllContracts } from './loader.js';

/**
 * Analyze the impact of a proposed contract change.
 *
 * @param projectRoot - project root path
 * @param contractId - contract being modified
 * @param changeType - type of change (modify, remove, deprecate)
 * @returns Full impact analysis with upstream/downstream effects
 */
export function analyzeContractImpact(
  projectRoot: string,
  contractId: string,
  changeType: 'modify' | 'remove' | 'deprecate',
): ContractImpactAnalysis {
  const registry = loadAllContracts(projectRoot);
  const contract = registry.contracts.find((c: Contract) => c.id === contractId);

  if (!contract) {
    return {
      contract_id: contractId,
      change_type: changeType,
      upstream_impact: [],
      downstream_impact: [],
      breaking: false,
      risk: 'low',
      mitigations: [`Contract "${contractId}" not found in registry — abort`],
    };
  }

  const upstream_impact = analyzeUpstreamImpact(contract, registry, changeType);
  const downstream_impact = analyzeDownstreamImpact(contract, registry, changeType);

  const breaking = determineBreakingChange(contract, changeType, upstream_impact, downstream_impact);
  const risk = calculateRiskLevel(contract, upstream_impact, downstream_impact);
  const mitigations = generateMitigations(contract, changeType, upstream_impact, downstream_impact);

  return {
    contract_id: contractId,
    change_type: changeType,
    upstream_impact,
    downstream_impact,
    breaking,
    risk,
    mitigations,
  };
}

/**
 * Analyze impact on upstream consumers (components that call this contract).
 */
function analyzeUpstreamImpact(
  contract: Contract,
  registry: ContractRegistry,
  changeType: 'modify' | 'remove' | 'deprecate',
): ImpactEntry[] {
  const entries: ImpactEntry[] = [];

  // Direct upstream consumers
  for (const upstreamId of contract.upstream) {
    const upstreamContract = registry.contracts.find((c: Contract) => c.id === upstreamId);
    const isExternal = !upstreamContract; // External consumer (outside project)

    entries.push({
      id: upstreamId,
      description: isExternal
        ? `External consumer depends on "${contract.name}" (${contract.category})`
        : `"${upstreamContract!.name}" depends on "${contract.name}"`,
      breaking: changeType === 'remove' || (changeType === 'modify' && contract.criticality === 'critical'),
      effort: changeType === 'remove'
        ? 'large'
        : changeType === 'deprecate'
          ? 'medium'
          : contract.criticality === 'critical' ? 'medium' : 'small',
    });
  }

  // Find undeclared upstream consumers
  // (contracts that list us in their downstream, but aren't in our upstream list)
  for (const other of registry.contracts) {
    if (other.id === contract.id) continue;
    if (other.downstream.includes(contract.id)) {
      if (!entries.find((e) => e.id === other.id)) {
        entries.push({
          id: other.id,
          description: `Undeclared upstream: "${other.name}" depends on "${contract.name}" but not listed in upstream`,
          breaking: false,
          effort: 'small',
        });
      }
    }
  }

  return entries;
}

/**
 * Analyze impact on downstream providers (components this contract depends on).
 */
function analyzeDownstreamImpact(
  contract: Contract,
  registry: ContractRegistry,
  changeType: 'modify' | 'remove' | 'deprecate',
): ImpactEntry[] {
  const entries: ImpactEntry[] = [];

  for (const downstreamId of contract.downstream) {
    const downstreamContract = registry.contracts.find((c: Contract) => c.id === downstreamId);

    entries.push({
      id: downstreamId,
      description: downstreamContract
        ? `"${contract.name}" depends on "${downstreamContract.name}" (${downstreamContract.category})`
        : `External provider "${downstreamId}" — verify compatibility`,
      breaking: changeType === 'modify' && contract.criticality === 'critical',
      effort: changeType === 'remove'
        ? 'trivial' // Removing dependency is easy
        : downstreamContract?.criticality === 'critical'
          ? 'medium'
          : 'small',
    });
  }

  return entries;
}

/**
 * Determine if the proposed change is breaking.
 */
function determineBreakingChange(
  contract: Contract,
  changeType: 'modify' | 'remove' | 'deprecate',
  upstream: ImpactEntry[],
  _downstream: ImpactEntry[],
): boolean {
  // Removing a contract is always breaking for its upstream consumers
  if (changeType === 'remove') {
    return upstream.length > 0;
  }

  // Deprecating a critical contract is breaking
  if (changeType === 'deprecate' && contract.criticality === 'critical') {
    return true;
  }

  // Modifying a contract with upstream breaking impact
  if (changeType === 'modify') {
    return upstream.some((e: ImpactEntry) => e.breaking);
  }

  return false;
}

/**
 * Calculate overall risk level.
 */
function calculateRiskLevel(
  contract: Contract,
  upstream: ImpactEntry[],
  downstream: ImpactEntry[],
): 'low' | 'medium' | 'high' {
  const totalImpact = upstream.length + downstream.length;
  const criticalChain =
    contract.criticality === 'critical' ||
    upstream.some((e: ImpactEntry) => e.breaking) ||
    downstream.some((e: ImpactEntry) => e.breaking);

  if (criticalChain && totalImpact > 2) return 'high';
  if (criticalChain || totalImpact > 3) return 'medium';
  if (totalImpact > 0) return 'low';
  return 'low';
}

/**
 * Generate recommended mitigation steps.
 */
function generateMitigations(
  contract: Contract,
  changeType: 'modify' | 'remove' | 'deprecate',
  upstream: ImpactEntry[],
  _downstream: ImpactEntry[],
): string[] {
  const mitigations: string[] = [];

  if (changeType === 'remove') {
    mitigations.push(`Notify all ${upstream.length} upstream consumer(s) before removal`);
    mitigations.push('Provide replacement contract or migration path');
    if (contract.criticality === 'critical') {
      mitigations.push('CRITICAL: Consider deprecation period before full removal');
    }
  }

  if (changeType === 'deprecate') {
    mitigations.push('Set deprecated status and provide migrationPath');
    mitigations.push(`Update ${upstream.length} upstream consumer(s) to switch to new contract`);
    if (contract.upstream.length > 0) {
      mitigations.push('Document deadline for migration completion');
    }
  }

  if (changeType === 'modify') {
    if (contract.criticality === 'critical') {
      mitigations.push('CRITICAL: Use version bump (major) for breaking modifications');
      mitigations.push('Run integration tests against all upstream consumers');
    }
    // Check for breaking upstream impact
    const breakingUpstreams = upstream.filter((e: ImpactEntry) => e.breaking);
    if (breakingUpstreams.length > 0) {
      mitigations.push(`Coordinate with ${breakingUpstreams.length} breaking upstream consumer(s): ${breakingUpstreams.map((e) => e.id).join(', ')}`);
    }
    mitigations.push('Run mumuspec validate after modification');
  }

  if (mitigations.length === 0) {
    mitigations.push('Low risk change — proceed with standard workflow');
  }

  return mitigations;
}

/**
 * Format impact analysis as human-readable report.
 */
export function formatImpactReport(analysis: ContractImpactAnalysis): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═══════════════════════════════════════════════════════');
  lines.push(`  Contract Impact Analysis: ${analysis.contract_id}`);
  lines.push(`  Change Type: ${analysis.change_type}`);
  lines.push(`  Risk Level:  ${analysis.risk.toUpperCase()}`);
  lines.push(`  Breaking:    ${analysis.breaking ? 'YES' : 'No'}`);
  lines.push('═══════════════════════════════════════════════════════');

  if (analysis.upstream_impact.length > 0) {
    lines.push('');
    lines.push('  Upstream Impact (consumers):');
    for (const entry of analysis.upstream_impact) {
      const icon = entry.breaking ? '[BREAK]' : '[WARN] ';
      lines.push(`    ${icon} ${entry.id} [${entry.effort}]`);
      lines.push(`       ${entry.description}`);
    }
  }

  if (analysis.downstream_impact.length > 0) {
    lines.push('');
    lines.push('  Downstream Impact (providers):');
    for (const entry of analysis.downstream_impact) {
      const icon = entry.breaking ? '[BREAK]' : '[WARN] ';
      lines.push(`    ${icon} ${entry.id} [${entry.effort}]`);
      lines.push(`       ${entry.description}`);
    }
  }

  lines.push('');
  lines.push('  Recommended Mitigations:');
  for (const m of analysis.mitigations) {
    lines.push(`    * ${m}`);
  }

  lines.push('═══════════════════════════════════════════════════════');
  lines.push('');

  return lines.join('\n');
}
