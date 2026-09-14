import { mkdirSync } from 'fs'
import { createId, nowIso } from '@domain/ids'
import { DEFAULT_DURATION } from '@application/duration'
import { DEFAULT_PLATFORMS } from '@application/platform-profiles'
import { listProjectFolders } from '@application/project-library'
import { writeProjectBundle } from '@application/project-bundle'
import type { Repositories } from '@infrastructure/db/repositories'
import type { ScriptDraft } from '@schemas/index'
import {
  mockExamples,
  mockFinalScript,
  mockPfdbi,
  mockStyleProfile,
  mockTemplates
} from '@infrastructure/llm/mock-payloads'

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
    category: '设计观点',
    notes: '口语拆前脸配方',
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
}

/**
 * 把旧版 SQLite 项目迁到 data/projects；库为空时再写演示文案。
 */
export function migrateOrSeedProjects(repos: Repositories, root: string): void {
  mkdirSync(root, { recursive: true })
  if (listProjectFolders(root).length > 0) return
  const projects = repos.listProjects()
  if (projects.length > 0) {
    for (const project of projects) {
      const finalDraft = repos.getScript<ScriptDraft>(project.id, 'final')
      writeProjectBundle(root, {
        id: project.id,
        title: project.title,
        topic: project.topic,
        draft: project.draft,
        facts: project.facts,
        platform: project.platform,
        durationSeconds: project.durationSeconds,
        contentType: project.contentType,
        pfdbi: repos.getPfdbi(project.id),
        script: finalDraft?.script ?? '',
        images: repos.listImages(project.id).map((image) => ({
          id: image.id,
          file: '',
          filename: image.filename,
          role: image.role,
          vehicleLabel: image.vehicleLabel,
          comparisonNote: image.comparisonNote,
          sourcePath: image.path
        })),
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      })
    }
    return
  }
  seedDemoProject(root)
}

/**
 * 项目库为空时写入一份演示文案到 data/projects，不走 SQLite。
 */
function seedDemoProject(root: string): void {
  const now = nowIso()
  writeProjectBundle(root, {
    id: createId('proj'),
    title: '演示项目：新能源前脸为什么越来越像（DEMO DATA）',
    topic: '为什么现在很多新能源汽车前脸越来越像？',
    draft: '感觉最近新车前脸都在用细灯带和封闭中网，想做成一期 5 分钟 B 站口播。',
    facts:
      '用户粘贴的事实补充（DEMO DATA）：多家新车发布会把贯穿灯带和封闭前脸称为家族最新识别；具体灯腔结构和进气开口以实车图为准，未在画面上确认的参数待核实。',
    platform: 'B站',
    durationSeconds: 300,
    contentType: '新车热点',
    pfdbi: mockPfdbi(),
    script: mockFinalScript().script,
    images: [],
    createdAt: now,
    updatedAt: now
  })
}
