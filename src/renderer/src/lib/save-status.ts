import type { ProjectSaveStatus } from '@shared/ipc'

/** 工作台顶栏和列表用的短状态词。 */
export const SAVE_STATUS_LABEL: Record<ProjectSaveStatus, string> = {
  unsaved: '未保存',
  dirty: '未更新',
  saved: '已保存'
}

/**
 * 缺省按未保存处理，避免旧数据没有状态字段时灯色空白。
 */
export function normalizeSaveStatus(status?: ProjectSaveStatus | null): ProjectSaveStatus {
  return status ?? 'unsaved'
}
