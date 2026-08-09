# Layer 1-3 Test Cases — Distributed Spec V2

## Layer 1: Component Integration

### TC-L1-01 ~ L1-03
(实现细节已记录在 layer-0-cases.md)

## Layer 2: CLI Integration
### TC-L2-01 ~ L2-02
(实现细节已记录在 layer-0-cases.md)

## Layer 3: End-to-End
### TC-L3-01 ~ T3-03
(实现细节已记录在 layer-0-cases.md)

## 实现映射

| 测试 | 目标文件 | 优先级 |
|------|---------|--------|
| TC-L0-01 ~ L0-06 | tests/spec/parser.test.ts (已有) + tests/spec/validator.test.ts (已有) | P0 |
| TC-L0-07 ~ L0-08 | tests/guard/checker.test.ts (新增) | P0 |
| TC-L1-01 ~ L1-03 | tests/spec/loader.test.ts (已有 31 tests 覆盖) | P0 |
| TC-L2-01 ~ L2-02 | tests/cli/init.test.ts (已有) | P1 |
| TC-L3-01 ~ L3-03 | tests/e2e/distributed-spec.test.ts (新增) | P1 |
