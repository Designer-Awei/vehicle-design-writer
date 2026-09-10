# vehicle-design-writer

汽车设计文案助手。面向汽车设计与审美内容团队的 Electron 桌面工具：用 PFDBI 想清楚“讲什么”，用车型参考图提供视觉证据，再用博主 Style DNA 决定“怎么说”。

## 功能

- 导入博主历史文案，提取 Style DNA、结构模板、few-shot
- 上传车型参考图，视觉观察与矩形标注
- PFDBI 五维设计评价（事实 / 推断 / 偏好分离）
- Base Draft → 模板匹配 → Style Adapter → 质量检查
- 成稿编辑、局部重写、版本、导出 TXT/MD
- 无 API Key 时 Demo Mode（MockLLM + DEMO DATA）

## 推荐工作流

1. 在风格库填写创作者信息，直接选择历史文案文件夹并提取 Style DNA。
2. 新建选题，进入工作台后上传参考图，按主分析车型 / 其他车型分类，并在比较说明中写清关系。
3. 预览图片并拖拽添加矩形标注，说明需要重点分析的设计区域。
4. 依次运行视觉观察和 PFDBI 评价；PFDBI 完成前不会开放成稿生成。
5. 配置平台、内容类型、时长、风格和初步草稿，生成并编辑最终稿。

详细的状态机、比较模型和验收标准见
[创作链路与交互重构 PRD V2](docs/prd_workflow-v2.md)。

## 安装

```bash
npm install
```

复制 `.env.example` 为 `.env`，填入 SiliconFlow Key：

```env
SILICONFLOW_API_KEY=你的密钥
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_TEXT_MODEL=deepseek-ai/DeepSeek-V4-Flash
SILICONFLOW_VISION_MODEL=Qwen/Qwen3-VL-32B-Instruct
```

密钥只在主进程读取，不会下发到渲染进程。

## 启动

```bash
npm run dev
```

## 测试

```bash
npm test
```

## 构建

```bash
npm run build:win
```

## SiliconFlow

OpenAI 兼容接口：`POST {baseUrl}/chat/completions`。文档见 [SiliconFlow API](https://api-docs.siliconflow.cn/docs)。文本与视觉模型都在设置页可改。

## 数据库

SQLite 位于系统 userData 目录。图片存本地路径，不写第三方图床，不把 base64 持久化进数据库。

## 常见问题

- 没有 Key：应用仍可打开，走 Demo Mode。
- 视觉模型报不支持：在设置中换成带 VL / vision 能力的模型。
- 编码：txt 尽量兼容 UTF-8 / GBK。
