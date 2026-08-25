# Test Cases — LLM Freedom Enhancement (R-0004)

## Layer 0: Unit Tests — workflow-recommender

### TC-L0-01: deriveRiskTier — low risk
- Given: estimated_files=1, no cross-module, no new API/dep/migration
- When: deriveRiskTier()
- Then: returns 'low'

### TC-L0-02: deriveRiskTier — medium risk (files > 4)
- Given: estimated_files=5
- When: deriveRiskTier()
- Then: returns 'medium'

### TC-L0-03: deriveRiskTier — medium risk (modules > 1)
- Given: modules_affected=2
- When: deriveRiskTier()
- Then: returns 'medium'

### TC-L0-04: deriveRiskTier — high risk (cross_module)
- Given: cross_module=true
- When: deriveRiskTier()
- Then: returns 'high'

### TC-L0-05: deriveRiskTier — high risk (files > 10)
- Given: estimated_files=15
- When: deriveRiskTier()
- Then: returns 'high'

### TC-L0-06: deriveRiskTier — high risk (new_public_api)
- Given: new_public_api=true
- When: deriveRiskTier()
- Then: returns 'high'

### TC-L0-07: estimateScope — correct risk assignment
- Given: mixed signals (cross_module=true, files=3)
- When: estimateScope()
- Then: risk_level is 'high' (cross_module dominates)

### TC-L0-08: checkSafetyFence — blocks on cross_module
- Given: cross_module=true
- When: checkSafetyFence()
- Then: blocks=true, triggers includes 'cross_module'

### TC-L0-09: checkSafetyFence — blocks on new_public_api
- Given: new_public_api=true
- When: checkSafetyFence()
- Then: blocks=true, triggers includes 'new_public_api'

### TC-L0-10: checkSafetyFence — blocks on new_external_dep
- Given: new_external_dep=true
- When: checkSafetyFence()
- Then: blocks=true, triggers includes 'new_external_dep'

### TC-L0-11: checkSafetyFence — blocks on data_migration
- Given: data_migration=true
- When: checkSafetyFence()
- Then: blocks=true, triggers includes 'data_migration'

### TC-L0-12: checkSafetyFence — no blocks
- Given: all fence conditions false
- When: checkSafetyFence()
- Then: blocks=false, triggers is empty

### TC-L0-13: recommendPath — safety fence forces full
- Given: cross_module=true (any file count)
- When: recommendPath()
- Then: path='full', confidence=0.95, safety_fence_blocks=true

### TC-L0-14: recommendPath — doc_only → tweak
- Given: is_doc_only=true, no fence triggers
- When: recommendPath()
- Then: path='tweak', confidence=0.9

### TC-L0-15: recommendPath — pure_bugfix low risk → hotfix
- Given: is_pure_bugfix=true, risk=low, files=1
- When: recommendPath()
- Then: path='hotfix', confidence=0.8

### TC-L0-16: recommendPath — medium risk → tweak
- Given: files=6, modules=2 (no fence triggers)
- When: recommendPath()
- Then: path='tweak', confidence=0.75

### TC-L0-17: recommendPath — small change → tweak
- Given: files=2, low risk, no special flags
- When: recommendPath()
- Then: path='tweak', confidence=0.85

### TC-L0-18: formatRecommendation — includes path and confidence
- Given: { path: 'full', confidence: 0.95, rationale: 'test' }
- When: formatRecommendation()
- Then: output contains 'Recommended Path: full' and 'Confidence: 95%'

### TC-L0-19: formatRecommendation — includes rationale
- Given: { path: 'tweak', confidence: 0.8, rationale: 'Small change' }
- When: formatRecommendation()
- Then: output contains 'Small change'

### TC-L0-20: formatRecommendation — includes safety fence triggers
- Given: safety_fence_blocks=true, fence_triggers=['cross_module']
- When: formatRecommendation()
- Then: output contains 'cross_module' and 'Safety Fence Active'

## Layer 1: CLI Integration Tests

### TC-L1-01: --files 1 --bugfix → recommends hotfix
- When: `mumuspec new test --files 1 --bugfix`
- Then: console output contains "Recommended: hotfix"

### TC-L1-02: --files 10 --cross-module → recommends full
- When: `mumuspec new test --files 10 --cross-module`
- Then: console output contains "Recommended: full"

### TC-L1-03: --doc-only → recommends tweak
- When: `mumuspec new test --doc-only`
- Then: console output contains "Recommended: tweak"

### TC-L1-04: proposal.md contains recommendation
- When: `mumuspec new test --files 2 --bugfix`
- Then: proposal.md contains "## Workflow Path Recommendation"

### TC-L1-05: state persists scope signals
- When: `mumuspec new test --files 3 --modules 2`
- Then: state.estimated_files = 3, state.modules_affected = 2

### TC-L1-06: no signals → no recommendation shown
- When: `mumuspec new test` (no flags)
- Then: console output does NOT contain "Recommended:"

### TC-L1-07: confidence percentage format
- When: `mumuspec new test --files 1 --bugfix`
- Then: console output matches pattern \d+% confidence

## Layer 2: BP Registry Tests

### TC-L2-01: registerBP adds to registry
- When: registerBP({ id: 'BP-99', description: 'Test', phase: 'design', required: true })
- Then: getBPRegistry().has('BP-99')

### TC-L2-02: clearBPRegistry empties registry
- When: registerBP(...) then clearBPRegistry()
- Then: getBPRegistry().size === 0

### TC-L2-03: getBPRegistry returns all registered
- When: register 3 BPs
- Then: getBPRegistry().size === 3

### TC-L2-04: registerBP overwrites existing ID
- When: register BP-99 twice with different descriptions
- Then: second registration wins
