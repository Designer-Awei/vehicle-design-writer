# vehicle-design-writer

汽车设计文案助手。面向汽车设计与审美内容团队的 Electron 桌面工具：在工作台一篇篇写稿，用选题、视觉素材和人眼 PFDBI 把“讲什么”想清楚，再自己写初稿并按口播时长核对字数。

## 功能

- 工作台项目：选题想法、视觉素材、设计分析、初稿文案四个纵向步骤
- 上传车型参考图，标记主分析 / 其他车型、车型标签和比较说明
- 双图对照预览（缩放、拖移），按 PFDBI 五维手写设计观察
- 初稿正文 + 标题 / 内容类型 / 预期时长；按每分钟 250 字检查字数
- 项目级事实补充（参数、发布会表述、报道、设计历史）
- 整篇保存写入安装目录 `data/projects`；导出时把当前项目文件夹打成 zip 安装包并自选地址
- 无 API Key 时 Demo Mode（MockLLM + DEMO DATA）

## 推荐工作流

需求变更以 [docs/ChangeLog.md](docs/ChangeLog.md) 为准，现行规格见 [docs/prd.md](docs/prd.md)。

**文案创作**：选题想法 → 视觉素材 → 对照看图写 PFDBI → 写初稿并核对字数。点保存写入项目库；导出 zip 安装包可交给同事导入。多写几篇，就是自己的文案风格积累。产品不再单独维护风格库。

文档目录说明见 [docs/README.md](docs/README.md)。旧的风格配置双链路与 V2 串行工作台已归档。

## 安装

```bash
npm install
```

复制 `.env.example` 为 `.env`，填入 SiliconFlow Key：

```env
SILICONFLOW_API_KEY=你的密钥
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_TEXT_MODEL=Qwen/Qwen3.5-27B
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

Windows 安装包：

```bash
npm run build:win
```

`npm run dist` 与上面相同。`dist` 根目录只保留：

- `汽车设计文案助手-1.0.0-portable/` 便携文件夹
- `汽车设计文案助手-1.0.0-setup.exe` 安装程序（可自选安装路径）
- `latest.yml` 增量更新清单

安装程序可以自选安装路径。便携文件夹里只有可执行程序，不含安装包。

## SiliconFlow

OpenAI 兼容接口：`POST {baseUrl}/chat/completions`。文档见 [SiliconFlow API](https://api-docs.siliconflow.cn/docs)。文本与视觉模型都在设置页可改。

## 数据库

SQLite 位于系统 userData 目录，主要存设置和风格演示数据。已保存的文案项目在安装目录 `data/projects/{标题}/`（设置里可改自定义根目录；默认始终跟当前安装目录走）。参考图在保存时写入该项目的 `参考图/`，上传过程不另复制一份。导出为 zip 安装包，由用户自选地址。不写第三方图床，不把 base64 当作长期存储。

## 常见问题

- 没有 Key：应用仍可打开，走 Demo Mode。
- 视觉模型报不支持：在设置中换成带 VL / vision 能力的模型。
- 编码：txt 尽量兼容 UTF-8 / GBK。
