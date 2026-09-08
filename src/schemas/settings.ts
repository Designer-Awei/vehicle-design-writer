import { z } from 'zod'

export const ModelCapabilitySchema = z.object({
  supportsText: z.boolean(),
  supportsVision: z.boolean(),
  supportsVideo: z.boolean(),
  supportsJson: z.boolean(),
  supportsStreaming: z.boolean()
})

export const LlmSettingsSchema = z.object({
  provider: z.literal('siliconflow'),
  baseUrl: z.string().min(1),
  textModel: z.string().min(1),
  visionModel: z.string().min(1),
  hasApiKey: z.boolean()
})

export const DurationProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  language: z.string(),
  wordsPerMinute: z.number().positive(),
  tolerancePercent: z.number().positive()
})

export const PlatformProfileSchema = z.object({
  platform: z.string(),
  contentLength: z.string(),
  hookDensity: z.string(),
  informationDensity: z.string(),
  paragraphLength: z.string(),
  ctaStyle: z.string(),
  titleStyle: z.string()
})

export const ImageAnnotationSchema = z.object({
  id: z.string().optional(),
  imageId: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  note: z.string()
})

export const CommercialBriefSchema = z.object({
  enabled: z.boolean(),
  brand: z.string(),
  model: z.string(),
  goal: z.string(),
  sellingPoints: z.array(z.string()),
  mustInclude: z.array(z.string()),
  mustAvoid: z.array(z.string()),
  placement: z.enum(['opening', 'middle', 'ending', 'narrative']),
  cta: z.string()
})

export type ModelCapability = z.infer<typeof ModelCapabilitySchema>
export type LlmSettings = z.infer<typeof LlmSettingsSchema>
export type DurationProfile = z.infer<typeof DurationProfileSchema>
export type PlatformProfile = z.infer<typeof PlatformProfileSchema>
export type ImageAnnotation = z.infer<typeof ImageAnnotationSchema>
export type CommercialBrief = z.infer<typeof CommercialBriefSchema>
