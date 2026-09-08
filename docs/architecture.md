# 架构

桌面端采用 Electron 主进程 / 预加载 / 渲染进程三层隔离。

```text
UI（React）
  → preload IPC
    → Application Service / Workflow
      → LLMProvider（SiliconFlow | Mock）
      → SQLite Repository
```

## 进程边界

- 渲染进程不能直接访问 SiliconFlow、文件系统或数据库。
- API Key 只存在于主进程：`.env` 启动注入 + Electron `safeStorage`。
- 结构化输出一律经 Zod 校验，失败则 JSON repair pass。

## 目录

- `src/domain` 标识与时间
- `src/schemas` Zod 契约
- `src/application` 工作流、模型路由、时长、评价框架
- `src/infrastructure` SQLite、LLM、文件解析、图片存储
- `src/prompts` 全部 Prompt 模板
- `src/main` 窗口与 IPC
- `src/renderer` UI

## 数据

本地 SQLite（`node:sqlite` DatabaseSync）位于 `userData/vehicle-design-writer.sqlite`。图片复制到 `userData/images/{projectId}`，库中只存路径与 hash。
