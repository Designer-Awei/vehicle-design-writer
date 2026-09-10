import { z } from 'zod'
import { StringArraySchema } from './common'

export const ImageRoleSchema = z.preprocess(
  (value) => {
    if (value === 'vertical' || value === 'horizontal') return 'other'
    return value
  },
  z.enum(['primary', 'other'])
)

/**
 * 把历史纵向/横向角色归一成其他车型。
 */
export function coerceImageRole(value: string | null | undefined): ImageRole {
  return value === 'primary' ? 'primary' : 'other'
}

export type ImageRole = 'primary' | 'other'

const EvidenceTextSchema = z.string().min(1).catch('暂无足够证据')
const EvidenceListSchema = StringArraySchema.catch([])

export const VehicleIdentificationSchema = z
  .object({
    brand: EvidenceTextSchema,
    model: EvidenceTextSchema,
    confidence: z.coerce.number().min(0).max(1).catch(0)
  })
  .catch({
    brand: '车型身份待确认',
    model: '车型身份待确认',
    confidence: 0
  })

export const VisionObservationSchema = z.object({
  imageId: z.string().catch(''),
  viewType: EvidenceTextSchema,
  vehicleIdentification: VehicleIdentificationSchema,
  overall: z
    .object({
      silhouette: EvidenceTextSchema,
      proportion: EvidenceTextSchema,
      stance: EvidenceTextSchema,
      visualCenterOfGravity: EvidenceTextSchema
    })
    .catch({
      silhouette: '暂无足够证据',
      proportion: '暂无足够证据',
      stance: '暂无足够证据',
      visualCenterOfGravity: '暂无足够证据'
    }),
  proportion: z
    .object({
      wheelSize: EvidenceTextSchema,
      wheelPlacement: EvidenceTextSchema,
      cabPosition: EvidenceTextSchema,
      frontRearOverhang: EvidenceTextSchema,
      bodyHeightWidthRelationship: EvidenceTextSchema
    })
    .catch({
      wheelSize: '暂无足够证据',
      wheelPlacement: '暂无足够证据',
      cabPosition: '暂无足够证据',
      frontRearOverhang: '暂无足够证据',
      bodyHeightWidthRelationship: '暂无足够证据'
    }),
  form: z
    .object({
      majorVolumes: EvidenceListSchema,
      surfacing: EvidenceListSchema,
      characterLines: EvidenceListSchema,
      shoulder: EvidenceTextSchema,
      roofline: EvidenceTextSchema,
      wheelArch: EvidenceTextSchema
    })
    .catch({
      majorVolumes: [],
      surfacing: [],
      characterLines: [],
      shoulder: '暂无足够证据',
      roofline: '暂无足够证据',
      wheelArch: '暂无足够证据'
    }),
  detail: z
    .object({
      headlamp: EvidenceTextSchema,
      taillamp: EvidenceTextSchema,
      frontGraphic: EvidenceTextSchema,
      wheelDesign: EvidenceTextSchema,
      windowGraphic: EvidenceTextSchema,
      decorativeElements: EvidenceListSchema
    })
    .catch({
      headlamp: '暂无足够证据',
      taillamp: '暂无足够证据',
      frontGraphic: '暂无足够证据',
      wheelDesign: '暂无足够证据',
      windowGraphic: '暂无足够证据',
      decorativeElements: []
    }),
  cmf: z
    .object({
      color: EvidenceTextSchema,
      material: EvidenceTextSchema,
      finish: EvidenceTextSchema
    })
    .catch({
      color: '暂无足够证据',
      material: '暂无足够证据',
      finish: '暂无足够证据'
    }),
  visualHierarchy: z
    .object({
      primaryFocus: EvidenceTextSchema,
      secondaryFocus: EvidenceTextSchema,
      visualNoise: EvidenceTextSchema
    })
    .catch({
      primaryFocus: '暂无足够证据',
      secondaryFocus: '暂无足够证据',
      visualNoise: '暂无足够证据'
    }),
  observations: EvidenceListSchema,
  uncertainties: EvidenceListSchema
})

export type VisionObservation = z.infer<typeof VisionObservationSchema>
