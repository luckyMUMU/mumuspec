# 新增 SHALL NOT 约束

## 安全
- SHALL NOT: env-spec.md MUST NOT 记录包含密码或密钥的环境变量
- SHALL NOT: 检测逻辑 MUST NOT 执行任意 shell 命令（仅运行只读版本查询）

## 性能
- SHALL NOT: 全量环境检测 MUST NOT 超过 2 秒
- SHALL NOT: 单项检测阻塞整体流程（MUST 容错）

## 功能边界
- SHALL NOT: 环境检测 MUST NOT 修改任何系统配置
- SHALL NOT: `env validate --fix` MUST NOT 安装缺失工具，仅报告
