import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { STYLE_STAGES } from '@renderer/navigation'
import { useWorkspaceBar } from '@renderer/workspace/WorkspaceContext'
import type { StyleDetail } from '@shared/ipc'

const DETAIL_TABS = [
  { id: 'overview', label: '总览' },
  { id: 'language', label: '语言' },
  { id: 'templates', label: '结构模板' },
  { id: 'examples', label: '例子' },
  { id: 'commercial', label: '商业' }
] as const

/**
 * Style DNA 详情：总览 / 语言 / 结构模板 / 例子。
 */
export function StyleDetailPage(): React.JSX.Element {
  const { id } = useParams()
  const [detail, setDetail] = useState<StyleDetail | null>(null)
  const [tab, setTab] = useState<(typeof DETAIL_TABS)[number]['id']>('overview')

  useWorkspaceBar({
    title: detail?.name ?? '风格详情',
    stages: [
      ...STYLE_STAGES,
      ...DETAIL_TABS.map((item) => ({ id: item.id, label: item.label }))
    ],
    activeStage: tab,
    onStageSelect: (stageId) => {
      if (DETAIL_TABS.some((item) => item.id === stageId)) {
        setTab(stageId as (typeof DETAIL_TABS)[number]['id'])
      }
    }
  })

  useEffect(() => {
    if (id) void window.api.styles.get(id).then(setDetail)
  }, [id])

  if (!detail) return <div className="page-fill text-sm text-[#9a8f82]">加载中…</div>
  const tone = detail.profile?.tone

  return (
    <div className="page-fill">
      <p className="text-sm text-[#9a8f82]">
        {detail.platform} · {detail.category}
        {detail.isDemo ? ' · DEMO DATA（虚构演示，非真实博主）' : ''}
      </p>
      <p className="text-xs text-[#9a8f82]">AI 分析指标，用于辅助理解风格特征。</p>
      <div className="rounded-2xl border border-[#2a241e] bg-[#161310] p-5">
        {tab === 'overview' && tone ? (
          <div className="grid grid-cols-3 gap-3 text-sm">
            {Object.entries(tone).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-[#0c0b0a] p-3">
                <div className="text-[#9a8f82]">{key}</div>
                <div className="text-xl text-[#c4a574]">{Math.round(value * 100)}</div>
              </div>
            ))}
            <div className="col-span-3 text-[#cfc3b5]">{detail.profile?.creator.description}</div>
          </div>
        ) : null}
        {tab === 'language' && detail.profile ? (
          <pre className="whitespace-pre-wrap text-sm text-[#cfc3b5]">
            {JSON.stringify(detail.profile.language, null, 2)}
          </pre>
        ) : null}
        {tab === 'templates' ? (
          <div className="space-y-4">
            {detail.templates.map((template) => (
              <div key={template.templateName} className="rounded-lg bg-[#0c0b0a] p-4">
                <div className="text-[#c4a574]">{template.templateName}</div>
                <div className="text-sm text-[#9a8f82]">{template.scenario}</div>
                <ol className="mt-2 list-decimal pl-5 text-sm">
                  {template.sections.map((section) => (
                    <li key={section.name}>
                      {section.name} · {Math.round(section.timePercent * 100)}% · {section.purpose}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        ) : null}
        {tab === 'examples' ? (
          <div className="space-y-3">
            {detail.examples.map((example) => (
              <blockquote
                key={example.excerpt}
                className="border-l-2 border-[#c4a574] pl-4 text-sm"
              >
                {example.excerpt}
                <div className="mt-1 text-xs text-[#9a8f82]">{example.whyRepresentative}</div>
              </blockquote>
            ))}
          </div>
        ) : null}
        {tab === 'commercial' && detail.profile ? (
          <pre className="whitespace-pre-wrap text-sm">
            {JSON.stringify(detail.profile.commercial, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  )
}
