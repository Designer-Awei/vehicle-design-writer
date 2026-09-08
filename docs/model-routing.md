# 模型路由

任务类型：

- `vision` → 设置中的 Vision Model
- `text` / `json` / `reasoning` → 设置中的 Text Model

模型名全部配置化，来源优先级：

1. 设置页
2. 根目录 `.env`（`SILICONFLOW_TEXT_MODEL` / `SILICONFLOW_VISION_MODEL`）
3. 代码内默认值（可被覆盖，不与产品逻辑绑定）

调用前按模型名推断能力。视觉任务遇到非视觉模型会明确报错。

SiliconFlow 文档：https://api-docs.siliconflow.cn/docs
