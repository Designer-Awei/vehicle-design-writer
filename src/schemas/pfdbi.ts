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
  counterArguments: StringArraySchema,
  facts: StringArraySchema,
  inferences: StringArraySchema,
  personalPreferences: StringArraySchema,
  coreConclusion: z.string(),
  contentOutline: StringArraySchema
})

export type PFDBIAnalysis = z.infer<typeof PFDBIAnalysisSchema>
export type PfdbiDimension = z.infer<typeof PfdbiDimensionSchema>
