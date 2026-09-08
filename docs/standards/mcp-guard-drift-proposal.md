# MCP Tool Schema Proposal: Guard & Drift Detection

**Status**: Draft（内部能力已实现：`detect_drift` / `check_compliance`；跨工具 MCP schema 标准化未落地，维持提案状态）
**Author**: MumuSpec Contributors
**Target**: MCP Working Group
**Format Version**: 1.0.0 (2026-08-09)

## 1. Abstract

This proposal defines standardized MCP tool interfaces for:

1. **Guard Evaluation** — Register and evaluate project constraints during AI-assisted coding
2. **Contract Drift Detection** — Detect divergence between declared contracts and implementation

MumuSpec already implements these capabilities. This proposal aims to establish cross-tool interoperability.

## 2. Problem Statement

Current AI coding assistants operate without awareness of external contracts (APIs, DB schemas, SDK signatures). When AI-generated code diverges from declared contracts, bugs surface only at integration time.

A shared schema enables:
- IDE-agnostic contract repositories
- Cross-tool audit trails
- Standardized drift reporting (SARIF)

## 3. Proposed Tool Schemas

### 3.1 `guard-evaluate`

Evaluate constraints for a file or project.

```json
{
  "name": "guard-evaluate",
  "description": "Evaluate constraints against project code",
  "inputSchema": {
    "type": "object",
    "properties": {
      "filePath": { "type": "string" },
      "scopes": { "type": "array", "items": { "type": "string" } },
      "failOn": { "type": "string", "enum": ["ERROR", "WARNING", "never"] }
    }
  }
}
```

### 3.2 `contract-drift-detect`

Run contract drift detection.

```json
{
  "name": "contract-drift-detect",
  "description": "Detect contract drift in the project",
  "inputSchema": {
    "type": "object",
    "properties": {
      "format": { "type": "string", "enum": ["default", "sarif", "problem-matcher"] },
      "category": { "type": "string", "enum": ["api", "database", "messaging", "sdk", "cli", "config"] }
    }
  }
}
```

### 3.3 `contract-register`

Register a new external contract.

```json
{
  "name": "contract-register",
  "description": "Register an external contract",
  "inputSchema": {
    "type": "object",
    "required": ["id", "name", "category", "source"],
    "properties": {
      "id": { "type": "string" },
      "name": { "type": "string" },
      "category": { "type": "string", "enum": ["api", "database", "messaging", "sdk", "cli", "config"] },
      "source": { "type": "string" },
      "version": { "type": "string" }
    }
  }
}
```

## 4. Standardized Output Formats

### 4.1 SARIF 2.1 (Default for drift reports)

All drift-detect tools **should** support SARIF 2.1 output. Reference schema: `https://json.schemastore.org/sarif-2.1.0.json`

### 4.2 VS Code Problem Matcher

Single-pattern problem matcher output for direct IDE integration:

```json
{
  "problems": [
    { "file": "src/api.ts", "line": 42, "column": 1, "severity": "error", "message": "..." }
  ]
}
```

## 5. Drift Report Schema

Reference: `.mumuspec/contracts/standard/drift-report-schema.json`

Core fields:
- `version`: schema version ("1.0.0")
- `timestamp`: ISO 8601 scan time
- `drifts[]`: array of ContractDrift findings
- `drifts[].type`: one of unimplemented | diverged | deprecated_in_use | schema_mismatch | orphaned_consumer | enforcement_violation
- `drifts[].severity`: ERROR | WARNING | INFO

## 6. Backward Compatibility

Existing Mumuspec commands remain unchanged:
- `mumuspec contract drift` → default output
- `mumuspec contract drift --format sarif` → SARIF 2.1
- `mumuspec contract drift --format problem-matcher` → VS Code format

## 7. Reference Implementation

MumuSpec v0.19+ ships with full implementation:
- `src/contract/formatter/sarif.ts` — SARIF serializer
- `src/contract/formatter/problem-matcher.ts` — Problem Matcher serializer

## 8. Next Steps

1. Gather community feedback (30-day comment period)
2. Submit to MCP Working Group as formal proposal
3. Implement conformance test suite
4. Integrate with VS Code extension marketplace
