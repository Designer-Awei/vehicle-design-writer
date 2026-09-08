import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { createPortal } from 'react-dom'

export interface WorkspaceStage {
  id: string
  label: string
  /** 有路径时作为二级菜单跳转，否则点击当前页阶段 */
  to?: string
  /** 尚未到达的进度阶段，仅展示不可点 */
  disabled?: boolean
}

export interface WorkspaceBarConfig {
  parent?: { to: string; label: string }
  title: string
  stages?: WorkspaceStage[]
  activeStage?: string
  onStageSelect?: (id: string) => void
}

interface WorkspaceContextValue {
  config: WorkspaceBarConfig
  setConfig: (config: WorkspaceBarConfig) => void
}

const defaultConfig: WorkspaceBarConfig = { title: '' }

const WorkspaceContext = createContext<WorkspaceContextValue>({
  config: defaultConfig,
  setConfig: () => undefined
})

/**
 * 工作区顶栏状态：二级菜单 / 进度阶段与上级入口。
 */
export function WorkspaceProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [config, setConfig] = useState<WorkspaceBarConfig>(defaultConfig)
  const value = useMemo(() => ({ config, setConfig }), [config])
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

/**
 * 向工作区顶栏注册当前页标题、上级与进度阶段。
 */
export function useWorkspaceBar(config: WorkspaceBarConfig): void {
  const { setConfig } = useContext(WorkspaceContext)
  const onStageSelectRef = useRef(config.onStageSelect)
  onStageSelectRef.current = config.onStageSelect
  const stagesKey =
    config.stages
      ?.map((item) => `${item.id}:${item.label}:${item.to ?? ''}:${item.disabled ? '1' : '0'}`)
      .join('|') ?? ''

  useLayoutEffect(() => {
    setConfig({
      parent: config.parent,
      title: config.title,
      stages: config.stages,
      activeStage: config.activeStage,
      onStageSelect: (id) => onStageSelectRef.current?.(id)
    })
  }, [config.parent?.to, config.parent?.label, config.title, config.activeStage, stagesKey, setConfig])

  useLayoutEffect(() => {
    return () => setConfig(defaultConfig)
  }, [setConfig])
}

/**
 * 读取当前顶栏配置。
 */
export function useWorkspaceBarState(): WorkspaceBarConfig {
  return useContext(WorkspaceContext).config
}

const ACTIONS_SLOT_ID = 'workspace-actions'

/**
 * 把页面主操作放到顶栏右侧，避免再占一块正文高度。
 */
export function WorkspaceActions({ children }: { children: ReactNode }): React.JSX.Element | null {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    setSlot(document.getElementById(ACTIONS_SLOT_ID))
  }, [])

  if (!slot) return null
  return createPortal(children, slot)
}

export { ACTIONS_SLOT_ID }
