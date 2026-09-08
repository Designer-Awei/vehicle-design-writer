import { createId, nowIso } from '@domain/ids'
import { DEFAULT_DURATION } from '@application/duration'
import { DEFAULT_PLATFORMS } from '@application/platform-profiles'
import type { Repositories } from '@infrastructure/db/repositories'
import {
  mockBaseDraft,
  mockExamples,
  mockFinalScript,
  mockPfdbi,
  mockQuality,
  mockStyleProfile,
  mockTemplates,
  mockVision
} from '@infrastructure/llm/mock-payloads'
import { PROMPT_VERSION } from '@shared/constants'

/**
 * 首次启动写入 DEMO DATA，保证无 API Key 也能演示完整流程。
 */
export function seedIfEmpty(repos: Repositories): void {
  for (const platform of DEFAULT_PLATFORMS) {
    repos.upsertPlatform(platform)
  }
  if (!repos.listDurations().some((item) => item.id === DEFAULT_DURATION.id)) {
    repos.upsertDuration(DEFAULT_DURATION)
  }
  if (repos.countStyles() > 0) return

  const styleId = createId('style')
  const now = nowIso()
  repos.upsertStyle({
    id: styleId,
    name: '演示创作者 A（DEMO DATA）',
    platform: 'B站',
    category: '汽车设计评论',
    notes: '虚构演示风格，不是真实博主文案。',
    isDemo: true,
    createdAt: now
  })
  const demoDocs = [
    {
      filename: 'demo-01.txt',
      content:
        '你有没有发现，很多车远看都像一家人。不是灯坏了，是配方重复了。前悬一短，舱体一后移，再加一条细灯，姿态就有了。可记忆点如果只靠灯，明天别人也能做一条。'
    },
    {
      filename: 'demo-02.txt',
      content:
        '先看前轮位置。座舱一往后，车头就会被拉长，这是姿态，不是装饰。品牌口中的运动，最后要落到轮距和肩线上。术语多不算风格，风格是你怎么把术语变成观众能看见的空间。'
    },
    {
      filename: 'demo-03.md',
      content:
        '## 结尾\n所以这件事不是谁抄谁。产品任务挤在同一条赛道，设计结论就会挤在同一张前脸。你觉得更像审美惰性，还是定义本身就没分开？'
    }
  ]
  for (const doc of demoDocs) {
    repos.insertDocument({
      styleId,
      filename: doc.filename,
      content: doc.content,
      wordCount: doc.content.length,
      parseStatus: 'ok',
      parseError: null
    })
  }
  repos.saveStyleProfile(styleId, mockStyleProfile())
  repos.replaceTemplates(styleId, mockTemplates())
  repos.replaceExamples(styleId, mockExamples())

  const projectId = createId('proj')
  repos.upsertProject({
    id: projectId,
    title: '演示项目：新能源前脸为什么越来越像（DEMO DATA）',
    topic: '为什么现在很多新能源汽车前脸越来越像？',
    draft: '感觉最近新车前脸都在用细灯带和封闭中网，想做成一期 5 分钟 B 站口播。',
    platform: 'B站',
    durationSeconds: 300,
    contentType: '热点设计评论',
    styleId,
    commercial: {
      enabled: false,
      brand: '',
      model: '',
      goal: '',
      sellingPoints: [],
      mustInclude: [],
      mustAvoid: [],
      placement: 'narrative',
      cta: ''
    },
    status: 'ready',
    createdAt: now,
    updatedAt: now
  })
  const vision = mockVision('img_demo')
  repos.saveVision(projectId, 'img_demo', vision, `demo:${PROMPT_VERSION}`)
  repos.savePfdbi(projectId, mockPfdbi(), `demo-pfdbi:${PROMPT_VERSION}`)
  repos.saveScript(projectId, 'base', mockBaseDraft())
  repos.saveScript(projectId, 'final', mockFinalScript())
  repos.saveScript(projectId, 'quality', mockQuality())
  repos.saveScript(projectId, 'match', {
    templateName: '单车型设计深度分析',
    reason: 'DEMO DATA：演示自动匹配结果。'
  })
  repos.addVersion(projectId, 'V1 Base Draft', mockBaseDraft().script)
  repos.addVersion(projectId, 'V2 Style Adapted', mockFinalScript().script)
}
