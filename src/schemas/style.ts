import { z } from 'zod'
import { ScoreSchema, StringArraySchema } from './common'

export const StyleProfileSchema = z.object({
  creator: z.object({
    name: z.string(),
    platform: z.string(),
    description: z.string()
  }),
  tone: z.object({
    professionalism: ScoreSchema,
    emotion: ScoreSchema,
    humor: ScoreSchema,
    sarcasm: ScoreSchema,
    warmth: ScoreSchema,
    aggressiveness: ScoreSchema
  }),
  language: z.object({
    sentenceLength: z.string(),
    rhythm: z.string(),
    vocabularyDensity: z.string(),
    technicalTermDensity: z.string(),
    metaphorFrequency: z.string(),
    colloquialism: z.string(),
    firstPersonUsage: z.string(),
    secondPersonUsage: z.string()
  }),
  argumentation: z.object({
    opinionVsFact: z.string(),
    opinionPosition: z.string(),
    evidenceUsage: z.string(),
    comparisonFrequency: z.string(),
    counterArgumentUsage: z.string(),
    reversalFrequency: z.string()
  }),
  rhetoric: z.object({
    hookPatterns: StringArraySchema,
    transitionPatterns: StringArraySchema,
    reversalPatterns: StringArraySchema,
    analogyPatterns: StringArraySchema,
    endingPatterns: StringArraySchema,
    ctaPatterns: StringArraySchema
  }),
  automotiveDesign: z.object({
    proportionAnalysis: z.string(),
    formAnalysis: z.string(),
    detailAnalysis: z.string(),
    brandAnalysis: z.string(),
    innovationAnalysis: z.string()
  }),
  commercial: z.object({
    sponsoredStyle: z.string(),
    integrationPatterns: StringArraySchema,
    brandMentionTiming: z.string(),
    ctaStyle: z.string()
  }),
  signaturePatterns: StringArraySchema,
  avoidPatterns: StringArraySchema,
  evidenceReferences: z.array(
    z.object({
      feature: z.string(),
      evidenceReferences: StringArraySchema
    })
  )
})

export const StructureSectionSchema = z.object({
  name: z.string(),
  timePercent: z.number().min(0).max(1),
  purpose: z.string(),
  instruction: z.string()
})

export const StructureTemplateSchema = z.object({
  templateName: z.string(),
  scenario: z.string(),
  applicableTopics: StringArraySchema,
  durationRange: z.string(),
  sections: z.array(StructureSectionSchema)
})

export const ExampleCaseSchema = z.object({
  sourceDocumentId: z.string(),
  scenario: z.string(),
  structure: z.string(),
  excerpt: z.string(),
  whyRepresentative: z.string()
})

export const TemplateBundleSchema = z.object({
  templates: z.array(StructureTemplateSchema)
})

export const ExampleBundleSchema = z.object({
  examples: z.array(ExampleCaseSchema)
})

export const DocumentAnalysisSchema = z.object({
  documentId: z.string(),
  topic: z.string(),
  structure: StringArraySchema,
  languageTraits: StringArraySchema,
  argumentationTraits: StringArraySchema,
  signatureLines: StringArraySchema,
  designKnowledgeVsStyle: z.string()
})

export type StyleProfile = z.infer<typeof StyleProfileSchema>
export type StructureTemplate = z.infer<typeof StructureTemplateSchema>
export type ExampleCase = z.infer<typeof ExampleCaseSchema>
export type DocumentAnalysis = z.infer<typeof DocumentAnalysisSchema>
