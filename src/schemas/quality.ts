import { z } from 'zod'
import { StringArraySchema } from './common'

export const QualityReportSchema = z.object({
  durationScore: z.number().min(0).max(1),
  pfdbiCoverage: z.record(z.string(), z.number()),
  styleConsistency: z.number().min(0).max(1),
  factRisk: StringArraySchema,
  genericPhraseRisk: StringArraySchema,
  copyRisk: StringArraySchema,
  suggestions: StringArraySchema,
  durationWarning: z.string().optional(),
  completeness: z.string().optional()
})

export const ScriptSchema = z.object({
  title: z.string(),
  outline: StringArraySchema,
  script: z.string(),
  pfdbiReferences: StringArraySchema
})

export const TemplateMatchSchema = z.object({
  templateName: z.string(),
  reason: z.string(),
  styleId: z.string().nullable().optional(),
  styleName: z.string().optional()
})

/** Agent 从已入库风格卡中挑选一张，或明确改用中性结构。 */
export const StyleSelectSchema = z.object({
  styleId: z.preprocess((value) => {
    if (value == null) return ''
    if (typeof value !== 'string') return String(value)
    const trimmed = value.trim()
    if (!trimmed || trimmed === 'null' || trimmed === 'none' || trimmed === 'neutral') return ''
    return trimmed
  }, z.string()),
  reason: z.string()
})

export const StyleQualitySchema = z.object({
  passed: z.preprocess((value) => {
    if (typeof value === 'boolean') return value
    if (value === 'true' || value === 1) return true
    if (value === 'false' || value === 0) return false
    return value
  }, z.boolean().catch(true)),
  issues: StringArraySchema,
  revisedNotes: StringArraySchema
})

export const RewriteSchema = z.object({
  text: z.string()
})

export type QualityReport = z.infer<typeof QualityReportSchema>
export type ScriptDraft = z.infer<typeof ScriptSchema>
export type TemplateMatch = z.infer<typeof TemplateMatchSchema>
export type StyleSelect = z.infer<typeof StyleSelectSchema>
export type StyleQuality = z.infer<typeof StyleQualitySchema>
export type RewriteResult = z.infer<typeof RewriteSchema>
