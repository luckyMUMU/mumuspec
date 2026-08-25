# Test Cases — Distributed Spec V2 (R-0003)

## Layer 0: Unit Tests (新增/补充)

### TC-L0-01: parsePrdFile 正确解析标准格式
- Given: 包含 doc_type: prd frontmatter + ## Requirement: 块的 prd.md
- When: 调用 parsePrdFile(content, path)
- Then: 返回 PrdFile 对象，requirements 包含提取的 SHALL/SHALL NOT

### TC-L0-02: parseTechFile 正确解析标准格式
- Given: 包含 doc_type: tech frontmatter + ## Requirement: 块的 tech.md
- When: 调用 parseTechFile(content, path)
- Then: 返回 TechFile 对象，requirements 包含提取的 SHALL/SHALL NOT

### TC-L0-03: serializePrdFile 往返一致
- Given: PrdFile 对象
- When: serializePrdFile(prd) → parsePrdFile(serialized)
- Then: 反序列化后 requirements 与原对象一致

### TC-L0-04: validatePrdFile 检测缺少 Requirement 块
- Given: V2 格式 prd.md 但无 ## Requirement: 块
- When: validatePrdFile(path, ...)
- Then: 推送 E-SPEC-011 warning

### TC-L0-05: validateTechFile 检测无效 layer
- Given: tech.md 中 layer 字段缺失或 < 0
- When: validateTechFile(path, ...)
- Then: 推送 E-SPEC-009 error

### TC-L0-06: checkParentReferences 检测无效 parent_prd
- Given: prd.md 中 parent_prd 指向不存在的文件
- When: checkParentReferences(...)
- Then: 推送 E-SPEC-010 error

### TC-L0-07: Guard Layer 从 prd.md 提取 SHALL NOT
- Given: prd.md 含 ## Requirement: X + ### SHALL NOT + 约束列表
- When: guard checker 执行 checkProhibitions
- Then: SHALL NOT 约束被纳入 prohibitions 检测

### TC-L0-08: Guard Layer 缺失 prd.md 时跳过
- Given: 项目仅有 spec.md 无 prd.md
- When: guard checker 执行
- Then: 不报错，正常执行 spec.md 检查

## Layer 1: Integration Tests

### TC-L1-01: loadSpecContext 加载分布式项目
- Given: 含 .mumuspec/prd.md + .mumuspec/tech.md 的项目
- When: loadSpecContext(projectRoot)
- Then: 返回的 SpecContext.prd 和 .tech 非空

### TC-L1-02: processInheritance 正确合并父级约束
- Given: 子目录 tech.md 有 parent_tech 指向父 tech.md
- When: processInheritance(tech, parentTech)
- Then: 子级 SHALL 包含父级 SHALL 的传递

### TC-L1-03: validateAllSpecs 覆盖所有分布文件
- Given: 多目录分布式项目
- When: validateAllSpecs(projectRoot, config)
- Then: 所有 spec.md/prd.md/tech.md 均被校验

## Layer 2: CLI Integration Tests

### TC-L2-01: mumuspec init --distributed 生成 prd/tech
- Given: 空项目目录
- When: 运行 mumuspec init --distributed
- Then: 根目录 .mumuspec/prd.md 和 tech.md 被创建

### TC-L2-02: mumuspec validate 对 prd/tech 报错
- Given: 含格式错误 prd.md 的项目
- When: 运行 mumuspec validate
- Then: 输出 E-SPEC-008/011 错误

## Layer 3: End-to-End Tests

### TC-L3-01: 完整分布式工作流
- Given: 临时项目目录
- When: init --distributed → 修改 prd.md → validate → context
- Then: validate 通过、context 输出含 prd/tech 数据

### TC-L3-02: Guard 在分布式项目工作
- Given: 含 prd.md 的 SHALL NOT 约束的项目
- When: 执行 guard check（通过 mumuspec guard <change> phase）
- Then: SHALL NOT 约束被正确检测

### TC-L3-03: 向后兼容 — 仅有 spec.md
- Given: 仅使用旧 spec.md 的项目
- When: validate + context
- Then: 正常运行，无 prd/tech 相关错误
