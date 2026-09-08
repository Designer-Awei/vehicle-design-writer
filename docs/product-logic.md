# 产品逻辑

系统严格拆成四层：

1. **视觉证据**：车型参考图只回答“看到了什么”。
2. **内容逻辑**：PFDBI 回答“讲什么、为什么这样判断”。
3. **表达方式**：Style DNA + Structure Template 回答“怎么说”。
4. **成稿约束**：平台与时长决定篇幅和节奏。

禁止把风格做成一句“请模仿 XXX 博主”。

禁止选题 + 图片 + 风格一次 Prompt 出终稿。必须：

Vision Observation → PFDBI Analysis → Base Draft → Template Selection → Style Adapter → Quality Check
