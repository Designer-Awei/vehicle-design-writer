/**
 * 判断左侧一级菜单是否应对应当前路径。
 * 文案项目的列表、新建和编辑统一归属文案工作台。
 */
export function isPrimaryActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/'
  if (to === '/workbench') return pathname.startsWith('/workbench')
  if (to === '/styles') return pathname.startsWith('/styles')
  if (to === '/settings') return pathname.startsWith('/settings')
  return pathname === to || pathname.startsWith(`${to}/`)
}

export const WORKBENCH_MENU = [
  { id: 'list', label: '项目列表', to: '/workbench' },
  { id: 'new', label: '新建文案', to: '/workbench/new' }
] as const

export const STYLE_STAGES = [
  { id: 'list', label: '风格列表', to: '/styles' },
  { id: 'new', label: '新增风格', to: '/styles/new' }
] as const

export const WORKFLOW_STAGES = [
  { id: 'vision', label: '参考图与观察' },
  { id: 'pfdbi', label: 'PFDBI 分析' },
  { id: 'script', label: '文案编辑' }
] as const
