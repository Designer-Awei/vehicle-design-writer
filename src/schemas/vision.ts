import { z } from 'zod'
import { StringArraySchema } from './common'

export const VehicleIdentificationSchema = z.object({
  brand: z.string(),
  model: z.string(),
  confidence: z.number().min(0).max(1)
})

export const VisionObservationSchema = z.object({
  imageId: z.string(),
  viewType: z.string(),
  vehicleIdentification: VehicleIdentificationSchema,
  overall: z.object({
    silhouette: z.string(),
    proportion: z.string(),
    stance: z.string(),
    visualCenterOfGravity: z.string()
  }),
  proportion: z.object({
    wheelSize: z.string(),
    wheelPlacement: z.string(),
    cabPosition: z.string(),
    frontRearOverhang: z.string(),
    bodyHeightWidthRelationship: z.string()
  }),
  form: z.object({
    majorVolumes: StringArraySchema,
    surfacing: StringArraySchema,
    characterLines: StringArraySchema,
    shoulder: z.string(),
    roofline: z.string(),
    wheelArch: z.string()
  }),
  detail: z.object({
    headlamp: z.string(),
    taillamp: z.string(),
    frontGraphic: z.string(),
    wheelDesign: z.string(),
    windowGraphic: z.string(),
    decorativeElements: StringArraySchema
  }),
  cmf: z.object({
    color: z.string(),
    material: z.string(),
    finish: z.string()
  }),
  visualHierarchy: z.object({
    primaryFocus: z.string(),
    secondaryFocus: z.string(),
    visualNoise: z.string()
  }),
  observations: StringArraySchema,
  uncertainties: StringArraySchema
})

export type VisionObservation = z.infer<typeof VisionObservationSchema>
