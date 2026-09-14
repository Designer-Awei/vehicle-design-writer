/**
 * 判断左侧一级菜单是否应对应当前路径。
 * 文案项目的列表、新建和编辑统一归属文案工作台。
 */
export function isPrimaryActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/'
  if (to === '/workbench') return pathname.startsWith('/workbench')
  if (to === '/settings') return pathname.startsWith('/settings')
  return pathname === to || pathname.startsWith(`${to}/`)
}

export const WORKBENCH_MENU = [
  { id: 'list', label: '项目列表', to: '/workbench' },
  { id: 'new', label: '新建文案', to: '/workbench/new' }
] as const

/** 打开项目后的纵向二级标签。 */
export const PROJECT_TABS = [
  { id: 'topic', label: '选题想法' },
  { id: 'visuals', label: '视觉素材' },
  { id: 'analysis', label: '设计分析' },
  { id: 'draft', label: '初稿文案' }
] as const

export type ProjectTabId = (typeof PROJECT_TABS)[number]['id']

/** 风格库入口已下线，仅避免未接线页面编译失败。 */
export const STYLE_STAGES = [{ id: 'list', label: '文案工作台', to: '/workbench' }] as const
