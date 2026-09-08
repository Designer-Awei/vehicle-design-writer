import { frameworkPromptBlock } from '@application/evaluation-framework'

const JSON_ONLY = '只输出 JSON 对象，不要 Markdown，不要解释。'

export function visionObservationPrompt(input: { imageId: string; annotations: string }): {
  system: string
  user: string
} {
  return {
    system: `你是汽车设计视觉观察员，不是评论员。只描述看到的设计事实、证据和不确定性。禁止输出最终审美结论、打分或“好看/难看”。无法确认品牌车型年份时，brand/model 必须写“车型身份待确认”，不得虚构。imageId 必须等于用户提供的值。${JSON_ONLY}`,
    user: `imageId=${input.imageId}\n用户标注（矩形为相对 0-1 坐标）：\n${input.annotations}\n请按 VisionObservation schema 输出：viewType, vehicleIdentification, overall, proportion, form, detail, cmf, visualHierarchy, observations, uncertainties。`
  }
}

export function pfdbiAnalysisPrompt(input: {
  topic: string
  draft: string
  vision: string
  extras: string
}): { system: string; user: string } {
  return {
    system: `你是汽车设计评价分析师。评价框架如下，必须遵守，不得把个人偏好写成客观结论。某维证据不足时 applicable=false，并写“暂无足够证据”，禁止硬凑。\n${frameworkPromptBlock()}\n输出 PFDBIAnalysis JSON。${JSON_ONLY}`,
    user: `选题：${input.topic}\n用户草稿：${input.draft}\n视觉观察：${input.vision}\n补充资料：${input.extras}\n请区分 facts / inferences / personalPreferences。`
  }
}

export function baseDraftPrompt(input: {
  topic: string
  durationSeconds: number
  platform: string
  pfdbi: string
  wordsPerMinute: number
}): { system: string; user: string } {
  const words = Math.round((input.durationSeconds / 60) * input.wordsPerMinute)
  return {
    system: `你在写 Base Draft：先把汽车设计逻辑写清楚，不要模仿任何博主。必须包含 outline、script、pfdbiReferences。事实/推断/偏好分开。视觉证据不足处写待核实。目标约 ${words} 字。${JSON_ONLY}`,
    user: `选题：${input.topic}\n平台：${input.platform}\n目标时长：${input.durationSeconds} 秒\nPFDBI：${input.pfdbi}`
  }
}

export function documentAnalysisPrompt(input: {
  documentId: string
  filename: string
  text: string
}): {
  system: string
  user: string
} {
  return {
    system: `你在提取汽车视频博主的写作风格，而不是复述主题知识。必须区分：主题、汽车专业知识、作者个人组织方式。术语多不等于个人风格。输出 DocumentAnalysis JSON。${JSON_ONLY}`,
    user: `documentId=${input.documentId}\n文件：${input.filename}\n正文：\n${input.text.slice(0, 8000)}`
  }
}

export function styleAggregationPrompt(input: { creator: string; analyses: string }): {
  system: string
  user: string
} {
  return {
    system: `你把多篇单文案分析聚合成一个 Style DNA。只保留跨样本稳定特征。每个主要结论都要带 evidenceReferences（文档 id）。不要脑补没出现过的风格。输出 StyleProfile JSON。${JSON_ONLY}`,
    user: `创作者：${input.creator}\n单篇分析：${input.analyses}`
  }
}

export function templateGenerationPrompt(input: { profile: string; documents: string }): {
  system: string
  user: string
} {
  return {
    system: `基于 Style DNA 生成多个场景化 Structure Templates，至少包含：热点设计评论、单车型设计深度分析。允许不同 section 组合。输出 { "templates": StructureTemplate[] }。${JSON_ONLY}`,
    user: `Style DNA：${input.profile}\n样本线索：${input.documents}`
  }
}

export function fewshotPrompt(input: { documents: string }): { system: string; user: string } {
  return {
    system: `从源文案挑选短片段作为 few-shot，禁止整篇复制。每个 excerpt 短、能说明结构或表达方式。输出 { "examples": ExampleCase[] }。${JSON_ONLY}`,
    user: input.documents
  }
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
