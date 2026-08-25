# src/contract — Contract Registry & Drift Detection

> External contract management with drift detection, boundary validation, and impact analysis.

## Where to Look

| Task | File | Notes |
|------|------|-------|
| Contract loading | `loader.ts` | Load from `contracts.yaml`, discover BOUNDARY.md files |
| Validation | `validator.ts` | Contract vs code validation, boundary validation |
| Impact analysis | `impact-analyzer.ts` | Upstream/downstream impact for contract changes |
| Contract CRUD | `manager.ts` | Persist, deprecate, remove contracts; audit logging; boundary scaffolding |

## Key Concepts

- **Contract fields**: `id` (API-001), `name`, `category`, `criticality`, `status`, `version`, `upstream`, `downstream`
- **Categories**: `api`, `database`, `sdk`, `cli`, `messaging`, `serialization`, `filesystem`, `config`
- **Drift detection**: Validates contracts against actual code implementation
- **Boundary documents**: `BOUNDARY.md` per directory, auto-scaffoldable via `scaffold_boundary`
- **Impact analysis**: Maps upstream/downstream dependencies for change proposals
- **Audit log**: All contract changes tracked in audit trail

## Conventions

- Contracts stored in `.mumuspec/contracts/contracts.yaml`
- Boundary documents auto-generated via `scaffold_boundary` tool
- Contract changes require impact analysis before approval

## Anti-Patterns

- **No contract changes without impact analysis**: Always run `analyze_contract_impact` first
- **No removing active contracts with consumers**: Blocked if upstream dependencies exist
- **No manual BOUNDARY.md edits**: Use `scaffold_boundary` to keep in sync with code
