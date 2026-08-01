---
id: DS-002
layer: 0
scope: scripts
delta: ADDED
---

## SHALL
- SHALL 提供 scripts/start.mjs 一键启动脚本
- SHALL 自动检测依赖是否安装（未安装则自动 npm install）
- SHALL 同时启动后端 API 服务和前端静态服务
- SHALL 支持环境变量配置端口和目录

## SHALL NOT
- SHALL NOT 修改现有服务代码（通过配置适配）
- SHALL NOT 写入系统目录（仅当前目录和子目录）
