import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { STYLE_STAGES } from '@renderer/navigation'
import { useWorkspaceBar } from '@renderer/workspace/WorkspaceContext'
import type { StyleRecord } from '@shared/ipc'

/**
 * 风格库列表。
 */
export function StylesPage(): React.JSX.Element {
  const [styles, setStyles] = useState<StyleRecord[]>([])
  useWorkspaceBar({
    title: '风格库',
    stages: [...STYLE_STAGES]
  })

  useEffect(() => {
    void window.api.styles.list().then(setStyles)
  }, [])

  return (
    <div className="page-fill">
      <div className="grid grid-cols-3 gap-4">
        {styles.map((style) => (
          <Link
            key={style.id}
            to={`/styles/${style.id}`}
            className="card-interactive rounded-2xl p-5"
          >
            <div className="flex items-center justify-between">
              <div className="text-lg">{style.name}</div>
              {style.isDemo ? <span className="text-xs text-[#c4a574]">DEMO DATA</span> : null}
            </div>
            <div className="mt-2 text-sm text-[#9a8f82]">
              {style.platform} · {style.category}
            </div>
            <p className="mt-3 text-sm text-[#cfc3b5]">{style.notes}</p>
            <div className="mt-4 text-xs text-[#9a8f82]">AI 分析指标仅用于辅助理解风格特征</div>
          </Link>
        ))}
      </div>
      {styles.length === 0 ? <div className="text-sm text-[#9a8f82]">还没有风格档案。</div> : null}
    </div>
  )
}
