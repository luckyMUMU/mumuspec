# Tasks — Distributed Spec V2 (R-0003)

> Bottom-up implementation order. 
> Predecessor tasks must complete before dependent tasks begin.

## Layer 0: Type Definitions

- [x] T0.1: Add `requirements?` field to `PrdFile` interface in types-spec.ts
- [x] T0.2: Update parser.ts to populate `requirements` for PrdFile
- [x] T0.3: Ensure backward compat — field is optional

## Layer 1: Parser (已完成)

- [x] T1.1: parsePrdFile — already implemented
- [x] T1.2: parseTechFile — already implemented
- [x] T1.3: serializePrdFile/serializeTechFile — already implemented

## Layer 2: Loader (已完成)

- [x] T2.1: loadSpecContext — already implemented
- [x] T2.2: processInheritance — already implemented
- [x] T2.3: findAllDistributedSpecDirs — already implemented

## Layer 3: Validator (已完成)

- [x] T3.1: validatePrdFile — already implemented
- [x] T3.2: validateTechFile — already implemented
- [x] T3.3: checkParentReferences (E-SPEC-010) — already implemented

## Layer 4: Guard Layer Integration

- [x] T4.1: Import parsePrdFile/parseTechFile in checker.ts
- [x] T4.2: Refactor collectAllProhibitions to delegate to collectDistributedProhibitions
- [x] T4.3: Implement collectDistributedProhibitions with backward compat
- [x] T4.4: Handle malformed prd/tech gracefully (silent skip)

## Layer 5: Integration Tests

- [x] T5.1: Create tests/e2e/ directory
- [x] T5.2: Write 13 e2e tests covering parser → validate → guard chain
- [x] T5.3: Verify backward compat (old format prd/tech silently skipped)
- [x] T5.4: Run full test suite (277 tests across spec/guard/e2e)

## Layer 6: Verify

- [ ] T6.1: Run `mumuspec guard distributed-spec-v2 build` — pass
- [ ] T6.2: Run `mumuspec check` — all modules ≥ 9/10
- [ ] T6.3: Review for any security/correctness issues
