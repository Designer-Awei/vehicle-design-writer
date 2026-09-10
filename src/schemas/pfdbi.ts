import { z } from 'zod'
import { StringArraySchema } from './common'

export const PfdbiDimensionSchema = z.object({
  observations: StringArraySchema,
  evidence: StringArraySchema,
  interpretation: z.string(),
  aestheticEffect: z.string(),
  judgement: z.string(),
  applicable: z.boolean().default(true)
})

export const PeerComparisonSchema = z.object({
  subjects: StringArraySchema,
  relation: z.string(),
  observations: StringArraySchema,
  differences: StringArraySchema,
  evidence: StringArraySchema
})

/** @deprecated 旧纵向比较结构，仅用于兼容已落库 JSON。 */
export const VerticalComparisonSchema = z.object({
  subjects: StringArraySchema,
  continuity: StringArraySchema,
  evolution: StringArraySchema,
  gains: StringArraySchema,
  tradeoffs: StringArraySchema,
  evidence: StringArraySchema
})

/** @deprecated 旧横向比较结构，仅用于兼容已落库 JSON。 */
export const HorizontalComparisonSchema = z.object({
  subjects: StringArraySchema,
  commonBrief: StringArraySchema,
  differentiators: StringArraySchema,
  relativeStrengths: StringArraySchema,
  tradeoffs: StringArraySchema,
  evidence: StringArraySchema
})

export const PFDBIAnalysisSchema = z.object({
  topic: z.string(),
  coreQuestion: z.string(),
  targetAudience: z.string(),
  P: PfdbiDimensionSchema,
  F: PfdbiDimensionSchema,
  D: PfdbiDimensionSchema,
  B: PfdbiDimensionSchema,
  I: PfdbiDimensionSchema,
  aestheticKeywords: StringArraySchema,
  comparisons: StringArraySchema,
  peerComparisons: z.array(PeerComparisonSchema).default([]),
  verticalComparisons: z.array(VerticalComparisonSchema).default([]),
  horizontalComparisons: z.array(HorizontalComparisonSchema).default([]),
  counterArguments: StringArraySchema,
  facts: StringArraySchema,
  inferences: StringArraySchema,
  personalPreferences: StringArraySchema,
  coreConclusion: z.string(),
  contentOutline: StringArraySchema
})

export type PFDBIAnalysis = z.infer<typeof PFDBIAnalysisSchema>
export type PfdbiDimension = z.infer<typeof PfdbiDimensionSchema>
