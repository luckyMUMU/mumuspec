# Implementation Tasks: add-env-spec

## Layer 0 — 类型定义与核心模块

### Task 0-1: 类型定义（types.ts）
- [ ] 添加 EnvironmentDetection 接口
- [ ] 添加 OSInfo 接口
- [ ] 添加 DetectedTool 接口
- [ ] 添加 ToolEcosystem 类型
- [ ] 添加 EnvironmentSpec 和 EnvSpecSection 接口

### Task 0-2: env-detector.ts 核心模块
- [ ] 实现 detectEnvironment() 函数
- [ ] 实现 detectTool() 函数
- [ ] 实现 detectRequiredEcosystems() 函数
- [ ] 实现 filterSensitiveVars() 函数
- [ ] 定义 DETECTOR_CONFIGS 预设配置
- [ ] 实现并行检测和超时保护

## Layer 1 — CLI 命令

### Task 1-1: mumuspec env detect
- [ ] 实现 detect 子命令
- [ ] 支持 --save 参数
- [ ] 支持 --ecosystem 参数
- [ ] 支持 --json 输出

### Task 1-2: mumuspec env validate
- [ ] 实现 validate 子命令
- [ ] 支持 --fix 参数
- [ ] 支持 --strict 模式
- [ ] 实现退出码规范（0/1/2/3）

### Task 1-3: mumuspec env diff
- [ ] 实现 diff 子命令
- [ ] 支持 --against 参数
- [ ] 输出版本差异对比

## Layer 2 — init 集成

### Task 2-1: init-generator.ts 扩展
- [ ] scaffoldKnowledgeBase() 中调用环境检测
- [ ] 实现 generateEnvKnowledgePage()
- [ ] 生成 env-spec.md 文件
