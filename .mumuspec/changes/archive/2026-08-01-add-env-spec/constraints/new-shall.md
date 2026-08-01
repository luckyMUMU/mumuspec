# 新增 SHALL 约束

## 环境检测器
- SHALL: 新增 `src/core/env-detector.ts` 模块实现环境检测
- SHALL: 检测逻辑 MUST 并行执行以提高性能
- SHALL: 单个工具检测 MUST 有 1 秒超时，超时视为未安装
- SHALL: 检测范围 MUST 覆盖 Java、Node、Python 三大生态

## 环境规范格式
- SHALL: 新增 `.mumuspec/env-spec.md` 文件格式
- SHALL: frontmatter MUST 包含 `type: environment`
- SHALL: Detected 部分 MUST 由 `env detect --save` 自动生成
- SHALL: SHALL/SHALL NOT 部分定义环境约束，可手动编辑

## CLI 命令
- SHALL: 新增 `mumuspec env detect` 命令
- SHALL: 新增 `mumuspec env validate` 命令
- SHALL: 新增 `mumuspec env diff` 命令
- SHALL: 检测输出 MUST 包含工具名称、版本、位置、状态
- SHALL: validate 命令 MUST 按检查严重度返回退出码

## 类型系统
- SHALL: `src/core/types.ts` MUST 新增 `EnvironmentDetection` 接口
- SHALL: `src/core/types.ts` MUST 新增 `DetectedTool` 接口
- SHALL: `src/core/types.ts` MUST 新增 `EnvironmentSpec` 接口

## init 集成
- SHALL: `mumuspec init` MUST 调用环境检测
- SHALL: 检测结果 MUST 写入初始 Knowledge Page
- SHALL: 检测到项目构建配置文件时 MUST 生成对应 `env-spec.md`
