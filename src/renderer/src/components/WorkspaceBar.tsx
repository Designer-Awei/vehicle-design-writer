import { NavLink } from 'react-router-dom'
import { ACTIONS_SLOT_ID, useWorkspaceBarState } from '@renderer/workspace/WorkspaceContext'
import { SAVE_STATUS_LABEL, normalizeSaveStatus } from '@renderer/lib/save-status'

/**
 * 工作区顶栏：标题（可切换项目）、保存状态灯与右侧操作。
 */
export function WorkspaceBar(): React.JSX.Element {
  const {
    title,
    stages = [],
    activeStage,
    onStageSelect,
    titleOptions,
    selectedTitleId,
    onTitleSelect,
    saveStatus
  } = useWorkspaceBarState()
  const status = saveStatus ? normalizeSaveStatus(saveStatus) : null

  return (
    <header className="workspace-bar">
      {titleOptions && titleOptions.length > 0 ? (
        <label className="workspace-title-switch">
          <span className="sr-only">切换项目</span>
          <select
            value={selectedTitleId ?? titleOptions[0]?.id}
            onChange={(event) => onTitleSelect?.(event.target.value)}
          >
            {titleOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      ) : title ? (
        <h1 className="workspace-title">{title}</h1>
      ) : null}
      {status ? (
        <span className={`project-status project-status--${status}`} title={SAVE_STATUS_LABEL[status]}>
          <span className="project-status-dot" aria-hidden />
          {SAVE_STATUS_LABEL[status]}
        </span>
      ) : null}
      {stages.length > 0 ? (
        <nav className="workspace-stages" aria-label="工作台导航">
          {stages.map((stage, index) => {
            const prefix = index > 0 ? <span className="workspace-stage-dot" aria-hidden /> : null
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
