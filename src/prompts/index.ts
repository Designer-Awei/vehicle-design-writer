import { frameworkPromptBlock } from '@application/evaluation-framework'

const JSON_ONLY = '只输出 JSON 对象，不要 Markdown，不要解释。'

const VISION_JSON_CONTRACT = `{
  "imageId": "必须原样返回用户提供的 imageId",
  "viewType": "视角，例如侧面/前45度/后45度",
  "vehicleIdentification": {
    "brand": "无法确认时写车型身份待确认",
    "model": "无法确认时写车型身份待确认",
    "confidence": 0.0
  },
  "overall": {
    "silhouette": "整体轮廓观察",
    "proportion": "整体比例观察",
    "stance": "姿态观察",
    "visualCenterOfGravity": "视觉重心观察"
  },
  "proportion": {
    "wheelSize": "轮径视觉占比",
    "wheelPlacement": "车轮位置",
    "cabPosition": "座舱位置",
    "frontRearOverhang": "前后悬关系",
    "bodyHeightWidthRelationship": "高宽关系"
  },
  "form": {
    "majorVolumes": ["主要体量"],
    "surfacing": ["型面特征"],
    "characterLines": ["特征线"],
    "shoulder": "肩部形体",
    "roofline": "车顶线",
    "wheelArch": "轮拱"
  },
  "detail": {
    "headlamp": "前灯",
    "taillamp": "尾灯",
    "frontGraphic": "前脸图形",
    "wheelDesign": "车轮设计",
    "windowGraphic": "车窗图形",
    "decorativeElements": ["装饰元素"]
  },
  "cmf": {
    "color": "颜色",
    "material": "材质",
    "finish": "表面处理"
  },
  "visualHierarchy": {
    "primaryFocus": "第一视觉焦点",
    "secondaryFocus": "第二视觉焦点",
    "visualNoise": "视觉噪音"
  },
  "observations": ["可直接从图片支持的关键观察"],
  "uncertainties": ["无法从图片确认的内容"]
}`

export function visionObservationPrompt(input: {
  imageId: string
  annotations: string
  role: 'primary' | 'other'
  vehicleLabel: string
  comparisonNote: string
}): {
  system: string
  user: string
} {
  return {
    system: `你是汽车设计视觉观察员，不是评论员。只描述看到的设计事实、证据和不确定性。禁止输出最终审美结论、打分或“好看/难看”。无法确认品牌车型年份时，brand/model 必须写“车型身份待确认”，不得虚构。imageId 必须等于用户提供的值。必须完整输出以下 JSON 结构，所有字段都必须存在；看不清的字符串写“暂无足够证据”，数组写 []，不得省略字段：\n${VISION_JSON_CONTRACT}\n${JSON_ONLY}`,
    user: `imageId=${input.imageId}\n图片角色：${input.role === 'primary' ? '主分析车型' : '其他车型'}\n用户填写的车型标签（未经外部验证）：${input.vehicleLabel || '未填写'}\n与主分析车型的关系/比较说明：${input.comparisonNote || '无'}\n用户标注（矩形为相对 0-1 坐标）：\n${input.annotations}\n优先观察标注区域；标记为“不要分析”的区域不得作为结论依据。请严格按约定的完整 JSON 结构输出。`
  }
}

/**
 * 为视觉响应的 JSON 修复步骤提供完整字段契约。
 */
export function visionObservationRepairInstruction(imageId: string): string {
  return `把原响应转换成以下完整 JSON 结构。imageId 必须为 ${imageId}。不得省略任何字段；缺失字符串填“暂无足够证据”，缺失数组填 []，confidence 缺失时填 0。不要保留结构外的替代字段：\n${VISION_JSON_CONTRACT}`
}

export function pfdbiAnalysisPrompt(input: {
  topic: string
  draft: string
  vision: string
  extras: string
}): { system: string; user: string } {
  return {
    system: `你是汽车设计评价分析师。评价框架如下，必须遵守，不得把个人偏好写成客观结论。某维证据不足时 applicable=false，并写“暂无足够证据”，禁止硬凑。\n${frameworkPromptBlock()}\n图片 role=primary 是主分析车型，允许 0 张或多张；role=other 是其他车型，它与主分析车型的关系以 comparisonNote 为准，不要自行套用同系不同代或同代不同系。没有 other 图片时 peerComparisons 必须为空。用户填写的车型标签未经外部验证，不得自动升级为事实。比较输出 peerComparisons，每项含 subjects/relation/observations/differences/evidence。输出 PFDBIAnalysis JSON。${JSON_ONLY}`,
    user: `选题：${input.topic}\n用户草稿：${input.draft}\n按角色组织的视觉证据：${input.vision}\n补充资料：${input.extras}\n请区分 facts / inferences / personalPreferences，并保证比较结论可追溯到图片观察。`
  }
}

export function baseDraftPrompt(input: {
  topic: string
  draft: string
  durationSeconds: number
  platform: string
  pfdbi: string
  wordsPerMinute: number
}): { system: string; user: string } {
  const words = Math.round((input.durationSeconds / 60) * input.wordsPerMinute)
  return {
    system: `你在写 Base Draft：先把汽车设计逻辑写清楚，不要模仿任何博主。必须包含 outline、script、pfdbiReferences。事实/推断/偏好分开。视觉证据不足处写待核实。目标约 ${words} 字。${JSON_ONLY}`,
    user: `选题：${input.topic}\n用户初步草稿：${input.draft || '无'}\n平台：${input.platform}\n目标时长：${input.durationSeconds} 秒\nPFDBI：${input.pfdbi}`
  }
}

const DOCUMENT_ANALYSIS_JSON_CONTRACT = `{
  "documentId": "必须原样返回用户提供的 documentId",
  "topic": "这篇文案在讨论什么",
  "structure": ["结构步骤"],
  "languageTraits": ["语言特点"],
  "argumentationTraits": ["论证特点"],
  "signatureLines": ["标志性说法"],
  "designKnowledgeVsStyle": "哪些是汽车设计知识，哪些是作者个人组织方式"
}`

const STYLE_PROFILE_JSON_CONTRACT = `{
  "creator": { "name": "创作者", "platform": "平台", "description": "人设描述" },
  "tone": {
    "professionalism": 0.5,
    "emotion": 0.5,
    "humor": 0.5,
    "sarcasm": 0.5,
    "warmth": 0.5,
    "aggressiveness": 0.5
  },
  "language": {
    "sentenceLength": "句长",
    "rhythm": "节奏",
    "vocabularyDensity": "用词密度",
    "technicalTermDensity": "术语密度",
    "metaphorFrequency": "比喻频率",
    "colloquialism": "口语程度",
    "firstPersonUsage": "第一人称",
    "secondPersonUsage": "第二人称"
  },
  "argumentation": {
    "opinionVsFact": "观点与事实关系",
    "opinionPosition": "观点出现位置",
    "evidenceUsage": "证据用法",
    "comparisonFrequency": "比较频率",
    "counterArgumentUsage": "反驳用法",
    "reversalFrequency": "反转频率"
  },
  "rhetoric": {
    "hookPatterns": ["开场"],
    "transitionPatterns": ["转场"],
    "reversalPatterns": ["反转"],
    "analogyPatterns": ["比喻"],
    "endingPatterns": ["收束"],
    "ctaPatterns": ["CTA"]
  },
  "automotiveDesign": {
    "proportionAnalysis": "比例",
    "formAnalysis": "形体",
    "detailAnalysis": "细节",
    "brandAnalysis": "品牌",
    "innovationAnalysis": "创新"
  },
  "commercial": {
    "sponsoredStyle": "商单风格",
    "integrationPatterns": ["植入方式"],
    "brandMentionTiming": "品牌出现时机",
    "ctaStyle": "CTA 风格"
  },
  "signaturePatterns": ["稳定特征"],
  "avoidPatterns": ["应避免的写法"],
  "evidenceReferences": [{ "feature": "特征", "evidenceReferences": ["文档id"] }]
}`

export function documentAnalysisPrompt(input: {
  documentId: string
  filename: string
  text: string
}): {
  system: string
  user: string
} {
  return {
    system: `你在提取汽车视频博主的写作风格，而不是复述主题知识。必须区分：主题、汽车专业知识、作者个人组织方式。术语多不等于个人风格。必须完整输出以下 JSON 结构，所有字段都必须存在；列表必须是数组，不得写成一整句。documentId 必须等于用户提供的值：\n${DOCUMENT_ANALYSIS_JSON_CONTRACT}\n${JSON_ONLY}`,
    user: `documentId=${input.documentId}\n文件：${input.filename}\n正文：\n${input.text.slice(0, 4500)}`
  }
}

/**
 * 为单篇风格分析的 JSON 修复步骤提供字段契约。
 */
export function documentAnalysisRepairInstruction(documentId: string): string {
  return `把原响应转换成以下完整 JSON 结构。documentId 必须为 ${documentId}。缺失字符串填“样本中未体现”，缺失数组填 []。列表必须是数组：\n${DOCUMENT_ANALYSIS_JSON_CONTRACT}`
}

export function styleAggregationPrompt(input: { creator: string; analyses: string }): {
  system: string
  user: string
} {
  return {
    system: `你把多篇单文案分析聚合成一个 Style DNA。只保留跨样本稳定特征。每个主要结论都要带 evidenceReferences（文档 id）。不要脑补没出现过的风格。tone 各分值为 0 到 1。必须完整输出以下 JSON 结构：\n${STYLE_PROFILE_JSON_CONTRACT}\n${JSON_ONLY}`,
    user: `创作者：${input.creator}\n单篇分析：${input.analyses}`
  }
}

/**
 * 为 Style DNA 聚合结果的 JSON 修复步骤提供字段契约。
 */
export function styleAggregationRepairInstruction(): string {
  return `把原响应转换成以下完整 JSON 结构。tone 分值必须是 0 到 1；缺失字符串填“样本中未体现”，缺失数组填 []：\n${STYLE_PROFILE_JSON_CONTRACT}`
}

const STYLE_SLICE_CONTRACTS: Record<string, { focus: string; contract: string }> = {
  tone: {
    focus: '只归纳创作者人设和语气六维分数',
    contract: `{
  "creator": { "name": "创作者", "platform": "平台", "description": "人设描述" },
  "tone": {
    "professionalism": 0.5,
    "emotion": 0.5,
    "humor": 0.5,
    "sarcasm": 0.5,
    "warmth": 0.5,
    "aggressiveness": 0.5
  }
}`
  },
  language: {
    focus: '只归纳句式、节奏、用词和人称',
    contract: `{
  "language": {
    "sentenceLength": "句长",
    "rhythm": "节奏",
    "vocabularyDensity": "用词密度",
    "technicalTermDensity": "术语密度",
    "metaphorFrequency": "比喻频率",
    "colloquialism": "口语程度",
    "firstPersonUsage": "第一人称",
    "secondPersonUsage": "第二人称"
  }
}`
  },
  argumentation: {
    focus: '只归纳观点、证据、比较和反转习惯',
    contract: `{
  "argumentation": {
    "opinionVsFact": "观点与事实关系",
    "opinionPosition": "观点出现位置",
    "evidenceUsage": "证据用法",
    "comparisonFrequency": "比较频率",
    "counterArgumentUsage": "反驳用法",
    "reversalFrequency": "反转频率"
  }
}`
  },
  rhetoric: {
    focus: '只归纳开场、转场、比喻、收束和 CTA 套路，必须是数组',
    contract: `{
  "rhetoric": {
    "hookPatterns": ["开场"],
    "transitionPatterns": ["转场"],
    "reversalPatterns": ["反转"],
    "analogyPatterns": ["比喻"],
    "endingPatterns": ["收束"],
    "ctaPatterns": ["CTA"]
  }
}`
  },
  automotive: {
    focus: '只归纳作者如何讲比例、形体、细节、品牌和创新，不要复述车型知识',
    contract: `{
  "automotiveDesign": {
    "proportionAnalysis": "比例",
    "formAnalysis": "形体",
    "detailAnalysis": "细节",
    "brandAnalysis": "品牌",
    "innovationAnalysis": "创新"
  }
}`
  },
  commercial: {
    focus: '只归纳商单植入、签名写法和应避免的写法',
    contract: `{
  "commercial": {
    "sponsoredStyle": "商单风格",
    "integrationPatterns": ["植入方式"],
    "brandMentionTiming": "品牌出现时机",
    "ctaStyle": "CTA 风格"
  },
  "signaturePatterns": ["稳定特征"],
  "avoidPatterns": ["应避免的写法"],
  "evidenceReferences": [{ "feature": "特征", "evidenceReferences": ["文档id"] }]
}`
  }
}

/**
 * 只提取 Style DNA 的一个切片，降低单次 JSON 体积和超时风险。
 */
export function styleSlicePrompt(input: {
  slice: keyof typeof STYLE_SLICE_CONTRACTS
  creator: string
  analyses: string
}): {
  system: string
  user: string
} {
  const spec = STYLE_SLICE_CONTRACTS[input.slice]
  return {
    system: `你把多样本分析聚合成 Style DNA 的一个切片。${spec.focus}。只保留跨样本稳定特征，不要脑补。tone 分值必须是 0 到 1。必须完整输出：\n${spec.contract}\n${JSON_ONLY}`,
    user: `创作者：${input.creator}\n单篇分析：${input.analyses}`
  }
}

/**
 * 为 DNA 切片修复步骤提供字段契约。
 */
export function styleSliceRepairInstruction(slice: keyof typeof STYLE_SLICE_CONTRACTS): string {
  const spec = STYLE_SLICE_CONTRACTS[slice]
  return `把原响应转换成以下完整 JSON。缺失字符串填“样本中未体现”，缺失数组填 []：\n${spec.contract}`
}

const SINGLE_TEMPLATE_JSON_CONTRACT = `{
  "templateName": "体现内容类型的中文名称",
  "scenario": "这个模板适合什么选题",
  "applicableTopics": ["内容类型"],
  "durationRange": "4-8 分钟",
  "sections": [
    {
      "name": "段落名，例如 Hook",
      "timePercent": 0.1,
      "purpose": "这一段要完成什么",
      "instruction": "这一段该怎么写"
    }
  ]
}`

const EXAMPLE_BUNDLE_JSON_CONTRACT = `{
  "examples": [
    {
      "sourceDocumentId": "必须是用户提供的文档 id",
      "scenario": "片段适用的内容类型",
      "structure": "这段体现的结构，例如 现象-证据-反转",
      "excerpt": "从原文摘出的短句，禁止整篇复制",
      "whyRepresentative": "为什么这段能代表作者写法"
    }
  ]
}`

/**
 * 只生成某一个内容类型的结构模板，避免一次吐出 6 份重复骨架。
 */
export function templateOnePrompt(input: {
  contentType: string
  profile: string
  analyses: string
}): {
  system: string
  user: string
} {
  return {
    system: `基于 Style DNA 生成 1 个场景化结构模板，只服务内容类型「${input.contentType}」。禁止输出其他类型，禁止 templates 数组，禁止“未命名模板/未命名段落”。templateName 必须包含「${input.contentType}」。sections 4 到 8 段，name/purpose/instruction 都要是具体中文。timePercent 为 0 到 1，之和接近 1。必须输出：\n${SINGLE_TEMPLATE_JSON_CONTRACT}\n${JSON_ONLY}`,
    user: `内容类型：${input.contentType}\nStyle DNA 摘要：${input.profile}\n单篇结构线索：${input.analyses}`
  }
}

/**
 * 为单份结构模板的 JSON 修复步骤提供字段契约。
 */
export function templateOneRepairInstruction(contentType: string): string {
  return `把原响应转换成单个模板 JSON，不要数组。templateName 必须体现「${contentType}」：\n${SINGLE_TEMPLATE_JSON_CONTRACT}`
}

/**
 * 从源文案挑选短的代表性片段，作为后续仿写的 few-shot。
 */
export function fewshotPrompt(input: { documents: string; documentIds: string }): {
  system: string
  user: string
} {
  return {
    system: `从源文案挑选 3 到 5 条短片段作为 few-shot，禁止整篇复制，禁止重复摘录。excerpt 必须来自原文原句，sourceDocumentId 必须是用户给出的文档 id 之一。必须完整输出：\n${EXAMPLE_BUNDLE_JSON_CONTRACT}\n${JSON_ONLY}`,
    user: `允许的 sourceDocumentId：${input.documentIds}\n源文案：\n${input.documents}`
  }
}

/**
 * 为 few-shot JSON 修复步骤提供字段契约。
 */
export function fewshotRepairInstruction(documentIds: string): string {
  return `把原响应转换成以下完整 JSON。excerpt 不能为空；sourceDocumentId 必须属于：${documentIds}：\n${EXAMPLE_BUNDLE_JSON_CONTRACT}`
}

export function styleQualityPrompt(input: { profile: string; docCount: number }): {
  system: string
  user: string
} {
  return {
    system: `审查 Style DNA：是否来自多样本、是否单篇偶然、是否混淆主题与风格、是否把汽车术语当独特性、是否过度概括、是否脑补、能否追溯 source documents。输出 StyleQuality JSON。${JSON_ONLY}`,
    user: `样本数：${input.docCount}\n${input.profile}`
  }
}

export function templateMatchPrompt(input: {
  topic: string
  contentType: string
  templates: string
}): {
  system: string
  user: string
} {
  return {
    system: `根据选题匹配最合适的 Structure Template。输出 { templateName, reason }。${JSON_ONLY}`,
    user: `选题：${input.topic}\n类型：${input.contentType}\n模板：${input.templates}`
  }
}

export function styleAdapterPrompt(input: {
  base: string
  profile: string
  template: string
  examples: string
  platform: string
  commercial: string
}): { system: string; user: string } {
  return {
    system: `你是 Style Adapter。必须保持 Base Draft 的事实、视觉证据、PFDBI 逻辑和核心结论。可以改 Hook、句式、节奏、结构、情绪、幽默、CTA。禁止因风格迁移改写事实，禁止整篇复写 few-shot。输出 Script JSON（title, outline, script, pfdbiReferences）。${JSON_ONLY}`,
    user: `Base Draft：${input.base}\nStyle DNA：${input.profile}\n结构模板：${input.template}\nFew-shot（仅结构参考）：${input.examples}\n平台：${input.platform}\n商单：${input.commercial}`
  }
}

export function scriptQualityPrompt(input: { script: string; pfdbi: string; duration: string }): {
  system: string
  user: string
} {
  return {
    system: `审查成稿：时长、PFDBI 覆盖、风格一致性、完整性、事实风险、无依据参数、套话、AI 腔、与源文案过近。模型不能验证外部事实，无来源的标“待核实”，不得编造。输出 QualityReport JSON。${JSON_ONLY}`,
    user: `时长估计：${input.duration}\n成稿：${input.script}\nPFDBI：${input.pfdbi}`
  }
}

export function rewritePrompt(input: { selected: string; instruction: string; context: string }): {
  system: string
  user: string
} {
  return {
    system: `只改写用户选中的片段，保持事实不变。输出 { "text": "改写后的片段" }。${JSON_ONLY}`,
    user: `指令：${input.instruction}\n选中文本：${input.selected}\n上下文：${input.context.slice(0, 2000)}`
  }
}
