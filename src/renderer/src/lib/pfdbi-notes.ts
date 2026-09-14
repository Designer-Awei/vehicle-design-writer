import type { PFDBIAnalysis, PfdbiDimension } from '@schemas/index'

export const PFDBI_KEYS = ['P', 'F', 'D', 'B', 'I'] as const

export type PfdbiKey = (typeof PFDBI_KEYS)[number]

export const PFDBI_LABELS: Record<PfdbiKey, string> = {
  P: 'P 比例姿态',
  F: 'F 型面',
  D: 'D 细节',
  B: 'B 品牌',
  I: 'I 创新'
}

/**
 * 空的一维 PFDBI，给人眼观察填写。
 */
export function emptyDimension(): PfdbiDimension {
  return {
    observations: [],
    evidence: [],
    interpretation: '',
    aestheticEffect: '',
    judgement: '',
    applicable: true
  }
}

/**
 * 从已存分析里取出各维人写正文。
 */
export function notesFromPfdbi(pfdbi: PFDBIAnalysis | null): Record<PfdbiKey, string> {
  return {
    P: pfdbi?.P.judgement || pfdbi?.P.observations.join('\n') || '',
    F: pfdbi?.F.judgement || pfdbi?.F.observations.join('\n') || '',
    D: pfdbi?.D.judgement || pfdbi?.D.observations.join('\n') || '',
    B: pfdbi?.B.judgement || pfdbi?.B.observations.join('\n') || '',
    I: pfdbi?.I.judgement || pfdbi?.I.observations.join('\n') || ''
  }
}

/**
 * 把人写的五维观察收成可入库的 PFDBI。
 */
export function pfdbiFromNotes(
  topic: string,
  notes: Record<PfdbiKey, string>,
  existing: PFDBIAnalysis | null
): PFDBIAnalysis {
  const base = existing ?? {
    topic,
    coreQuestion: topic,
    targetAudience: '',
    P: emptyDimension(),
    F: emptyDimension(),
    D: emptyDimension(),
    B: emptyDimension(),
    I: emptyDimension(),
    aestheticKeywords: [],
    comparisons: [],
    peerComparisons: [],
    verticalComparisons: [],
    horizontalComparisons: [],
    counterArguments: [],
    facts: [],
    inferences: [],
    personalPreferences: [],
    coreConclusion: '',
    contentOutline: []
  }
  const next = { ...base, topic, coreQuestion: base.coreQuestion || topic }
  for (const key of PFDBI_KEYS) {
    const text = notes[key].trim()
    next[key] = {
      ...emptyDimension(),
      ...base[key],
      judgement: text,
      observations: text ? [text] : [],
      applicable: Boolean(text)
    }
  }
  next.coreConclusion = notes.P.trim() || notes.F.trim() || notes.D.trim() || next.coreConclusion
  return next
}
