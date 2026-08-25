# Proposal: test-knowledge-extraction

## Summary
Test change to validate the full workflow with knowledge extraction (D1-D8).

## Scope
Affected: src/api, src/models

## Motivation
Verify that archive correctly creates knowledge pages from cognitive-map.yaml and decisions.md artifacts.

## Plan
- Walk through full workflow: open → design → build → verify → archive
- Trigger knowledge extraction with cognitive-map and decisions.md
- Verify knowledge pages created in .mumuspec/knowledge/

## Risks
- None (test change)
