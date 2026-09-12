# Test Cases — skill-plugin-standard (Layer 4: src/core 错误码注册)

## L4-1 四个新码全部注册

- Given: 本变更引入 W-SKILL-001 / E-SKILL-002 / E-SKILL-003 / E-BUNDLE-001
- When: 读取 src/core/errors.ts 的 ERROR_CODES
- Then: 四个码均在册，severity 分别为 WARN / ERROR / ERROR / ERROR

## L4-2 生成文档覆盖注册表

- Given: ERROR_CODES 增加条目
- When: 运行 node scripts/gen-error-codes-doc.mjs
- Then: 四个新码出现在 docs/reference/error-codes.md

## L4-3 既有守卫可拦截漏注册

- Given: 从 ERROR_CODES 移除 W-SKILL-001
- When: 运行 tests/guard/error-code-registry.test.ts
- Then: 测试失败（扫描面 guard + spec，新码在使用点被字面量引用）
