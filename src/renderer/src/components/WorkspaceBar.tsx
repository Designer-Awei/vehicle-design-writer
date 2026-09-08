import { NavLink } from 'react-router-dom'
import { ACTIONS_SLOT_ID, useWorkspaceBarState } from '@renderer/workspace/WorkspaceContext'

/**
 * 工作区顶部二级菜单：对应当前一级模块的进度阶段，固定高度，不挤占正文。
 */
export function WorkspaceBar(): React.JSX.Element {
  const { title, stages = [], activeStage, onStageSelect } = useWorkspaceBarState()

  return (
    <header className="workspace-bar">
      {title ? <h1 className="workspace-title">{title}</h1> : null}
      {stages.length > 0 ? (
        <nav className="workspace-stages" aria-label="进度阶段">
          {stages.map((stage, index) => {
            const prefix =
              index > 0 ? <span className="workspace-stage-dot" aria-hidden /> : null
            if (stage.to && !stage.disabled) {
              return (
                <NavLink
                  key={stage.id}
                  to={stage.to}
                  end
                  className={({ isActive }) =>
                    `workspace-stage${isActive ? ' workspace-stage-active' : ''}`
                  }
                >
                  {prefix}
                  {stage.label}
                </NavLink>
              )
            }
            const active = activeStage === stage.id
            return (
              <button
                key={stage.id}
                type="button"
                className={`workspace-stage${active ? ' workspace-stage-active' : ''}`}
                disabled={stage.disabled}
                onClick={() => onStageSelect?.(stage.id)}
              >
                {prefix}
                {stage.label}
              </button>
            )
          })}
        </nav>
      ) : null}
      <div id={ACTIONS_SLOT_ID} className="workspace-actions" />
    </header>
  )
}
