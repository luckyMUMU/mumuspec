# New SHALL NOT Constraints

- SHALL NOT 在 workflows 段缺少 phase_bps 时改变既有解析与校验行为（缺省合法，向后兼容）。
- SHALL NOT 因 phase_bps 非法而崩溃，必须走既有 fail-safe 路径（console.warn 加内置默认配置）。
- SHALL NOT 让 W-GRAPH-001 以 error 级别发出，也不得在 skill 侧 workflow.yaml 缺失时阻断 graph verify。
- SHALL NOT 改变任何既有 BP 的存在性或人工确认机制。
