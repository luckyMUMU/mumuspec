# 漂移检测规则

> 层级: Level 2 参考文档

> 漂移检测分为 P0（必需，Pre-commit）、P1（重要，CI）、P2（可选，Report）三级。详见 §漂移检测分级。

---

## 规范漂移

规范描述的约束与代码实际行为不一致。

**级别**：P0（必需，Pre-commit 阶段阻断提交）

```yaml
spec_drift:
  - check: "Spec says SHALL use @RestController, but code has @Controller"
    detection: "compare spec bindings with AST analysis"
    severity: WARN
    auto_fix: false

  - check: "Spec says SHALL NOT use console.log, but code has console.log"
    detection: "lint rule"
    severity: ERROR
    auto_fix: false
```

## SHALL NOT 违规漂移

SHALL NOT 反向禁止约束被代码违反，作为 spec_drift 的专项快速检查在 Pre-commit 阶段执行。

**级别**：P0（必需，Pre-commit 阶段阻断提交）

```yaml
shall_not_violation:
  - check: "代码违反 spec.md 中声明的 SHALL NOT 约束"
    detection: "lint rule subset of SHALL NOT checks"
    severity: ERROR
    auto_fix: false
    recommendation: "移除违反 SHALL NOT 约束的代码"
```

## 图谱漂移

代码图谱与实际代码不一致。

**级别**：P1（重要，CI 阶段阻断合并）

```yaml
graph_drift:
  - check: "Function in graph but deleted from code"
    detection: "compare graph nodes with actual files"
    severity: ERROR
    auto_fix: true   # 自动重新索引

  - check: "Call edge in graph but function signature changed"
    detection: "compare graph edges with AST analysis"
    severity: WARN
    auto_fix: true
```

## 索引新鲜度

**级别**：P1（重要，CI 阶段；与 graph_drift 同组）

```yaml
index_freshness:
  - check: "Code changed after last index"
    detection: "compare git diff with index timestamp"
    severity: WARN
    auto_fix: false
    recommendation: "Run mumuspec index to update"
```

## 测试不可变性漂移（0.6.0 新增）

**级别**：P1（重要，CI 阶段阻断合并）

```yaml
test_immutability_drift:
  - check: "test-cases/ content hash mismatch with .mumuspec.yaml design_content_hash"
    detection: "compute hash of test-cases/ directory and compare with recorded hash"
    severity: ERROR
    auto_fix: false
    recommendation: "测试用例定义被篡改，需回退到 Design 阶段重新设计"

  - check: "Test suite file hash mismatch with suite-map.yaml recorded hash"
    detection: "compute hash of each test suite file and compare with suite-map.yaml"
    severity: ERROR
    auto_fix: false
    recommendation: "测试套件文件被篡改，需回退到 Design 阶段重新设计"

  - check: "Test suite file count mismatch with suite-map.yaml mappings"
    detection: "compare actual test files with suite-map.yaml mappings"
    severity: ERROR
    auto_fix: false
    recommendation: "测试套件文件被新增或删除，需回退到 Design 阶段重新设计"
```

## 契约漂移（0.8.0 新增）

**级别**：P2（可选，仅生成报告；含 6 类子项）

### 外部服务契约漂移

```yaml
contract_drift:
  # 契约声明了未使用的端点
  - check: "外部服务契约声明的端点在代码中未被调用"
    detection: "compare contracts/external/ endpoints with CONSUMES edges in code graph"
    severity: WARN
    auto_fix: false
    recommendation: "契约声明了未使用的端点，考虑清理或确认是否遗漏调用"

  # 代码调用了外部服务但无契约
  - check: "代码中调用了外部服务但无对应契约声明"
    detection: "scan RPC/HTTP calls in code and check against contracts/external/ registry"
    severity: ERROR
    auto_fix: false
    recommendation: "发现未声明的跨服务调用，需在 contracts/external/ 中补充对应契约"

  # RPC 调用策略不一致
  - check: "代码中 RPC 调用策略与契约声明不一致（超时/重试/熔断）"
    detection: "AST analyze RPC call sites and compare timeout/retry/circuit-breaker config with contract policies"
    severity: ERROR
    auto_fix: false
    recommendation: "RPC 调用策略偏离契约声明，需调整代码或更新契约"
```

### 自身对外契约漂移

```yaml
  # 代码暴露的接口未声明
  - check: "代码暴露的接口未在 outbound 契约中声明"
    detection: "scan route/controller/rpc-service definitions and compare with contracts/outbound/ endpoints"
    severity: ERROR
    auto_fix: false
    recommendation: "发现未声明的对外暴露接口，需在 contracts/outbound/ 中补充对应契约"

  # 契约声明的端点代码中不存在
  - check: "outbound 契约声明的端点在代码中不存在"
    detection: "compare contracts/outbound/ endpoints with EXPOSES edges in code graph"
    severity: ERROR
    auto_fix: false
    recommendation: "契约声明的端点在代码中未实现，可能是代码删除未更新契约"
```

### 向后兼容性漂移

```yaml
  # stable 端点字段被删除
  - check: "stable 端点的响应字段被删除"
    detection: "compare current outbound contract with previous version, detect field removal on stable endpoints"
    severity: ERROR
    auto_fix: false
    recommendation: "向后兼容性破坏：stable 端点字段被删除，需回退或标记 deprecation"

  # stable 端点字段类型被改变
  - check: "stable 端点的字段类型被改变"
    detection: "compare current outbound contract with previous version, detect type changes on stable endpoints"
    severity: ERROR
    auto_fix: false
    recommendation: "向后兼容性破坏：stable 端点字段类型变更，需新增字段而非修改"
```

### 契约注册表漂移

```yaml
  # 契约文件未注册
  - check: "contracts/ 目录中的文件未在 _registry.yaml 中注册"
    detection: "scan contracts/ directory and compare with _registry.yaml entries"
    severity: WARN
    auto_fix: true   # 自动注册到 _registry.yaml
    recommendation: "新添加的契约文件未注册，已自动注册"

  # 派生约束不一致
  - check: "契约派生约束与 spec.md 中的注入约束不一致"
    detection: "compare derived_constraints in contract files with auto-derived constraints in spec.md"
    severity: ERROR
    auto_fix: true   # 自动重新注入派生约束
    recommendation: "派生约束被手动修改或未同步，已自动重新注入"
```

## 知识漂移（0.9.0 新增）

**级别**：P2（可选，仅生成报告；含 4 类子项）

```yaml
knowledge_drift:
  # 知识页面关联的代码节点已删除
  - check: "知识页面 graph_bindings 中的代码节点在图谱中不存在"
    detection: "compare knowledge page graph_bindings with code graph nodes"
    severity: ERROR
    auto_fix: false
    recommendation: "代码已删除，知识页面需标记为 deprecated 或更新关联"

  # 知识页面过期
  - check: "知识页面 verified_at 超过 freshness 配置阈值"
    detection: "compare verified_at with current date and config freshness settings"
    severity: WARN
    auto_fix: false
    recommendation: "知识页面长期未验证，建议在设计阶段重新确认"

  # 决策被覆盖但未标记 superseded
  - check: "代码实际行为与 confirmed 决策矛盾"
    detection: "compare decision content with code graph analysis"
    severity: ERROR
    auto_fix: false
    recommendation: "代码偏离了已有决策，需创建新变更更新决策或回退代码"

  # PageIndex 与实际文件不一致
  - check: "PageIndex 注册的知识页面文件不存在"
    detection: "compare _index.yaml entries with actual files"
    severity: WARN
    auto_fix: true   # 自动从索引中移除
    recommendation: "知识文件被手动删除，已自动更新索引"
```

## Ponytail 约束漂移（0.10.0 新增）

**级别**：P1（重要，CI 阶段阻断合并）

```yaml
ponytail_drift:
  # 代码引入了未在 design.md 中声明的新依赖
  - check: "代码引入了未在 design.md 中声明的新依赖"
    detection: "compare package.json/requirements.txt with design.md dependency declarations"
    severity: ERROR
    auto_fix: false
    recommendation: "新依赖需在设计阶段声明，或用 ponytail: 注释标记理由"

  # 代码存在未被请求的抽象层
  - check: "代码存在未被请求的抽象层"
    detection: "AST analysis for unnecessary abstraction patterns"
    severity: WARN
    auto_fix: false
    recommendation: "检查是否违反 YAGNI，用 ponytail: 注释标记或移除"
```

## 设计文档漂移

design.md 描述的组件关系与代码图谱不一致。

**级别**：P2（可选，仅生成报告）

```yaml
design_doc_drift:
  - check: "design.md 描述的组件依赖关系与代码图谱实际边不一致"
    detection: "compare design.md component relations with code graph edges"
    severity: WARN
    auto_fix: false
    recommendation: "设计文档与代码偏离，建议在设计阶段同步更新 design.md"
```

---

> **导航**: [← Phase Guard](phase-guards.md) | [认知框架 →](cognitive-framework.md) | [返回概览](../overview.md)
