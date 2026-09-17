# New SHALL NOT Constraints

- SHALL NOT corpus 聚合与 kill 判定引入 LLM 判定或手写指标值
- SHALL NOT 新评估器改变既有 loop composite 权重之和、收敛阈值与稳定窗口
- SHALL NOT 语料文件位于 tests、temp 等会被规范 walker 递归扫描的路径
- SHALL NOT custom 场景类型落入未知类型分支输出 warning
- SHALL NOT report 输出改变 check 与 validate 命令的既有 JSON schema
- SHALL NOT 将探针启动失败或输出不可解析的 fixture 计为漏检
- SHALL NOT 静默丢弃无 expected.yaml 声明的语料子目录
- SHALL NOT 静默跳过已声明聚合阈值的断言
