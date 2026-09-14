import { BrowserWindow, Menu, shell } from 'electron'

export const TITLEBAR_OVERLAY = {
  color: '#120f0c',
  symbolColor: '#f3ece1',
  height: 36
} as const

export type AppMenuId = 'file' | 'edit' | 'view' | 'window' | 'help'

const MENU_ROLES: Record<AppMenuId, string> = {
  file: 'fileMenu',
  edit: 'editMenu',
  view: 'viewMenu',
  window: 'windowMenu',
  help: 'help'
}

/**
 * 安装 Electron 默认菜单，供快捷键和自定义顶栏弹出子菜单共用。
 */
export function installDefaultMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: (): void => {
            void shell.openExternal('https://www.electronjs.org')
          }
        }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/**
 * 在自定义顶栏按钮下方弹出对应的系统菜单。
 */
export function popupAppMenu(
  window: BrowserWindow,
  id: AppMenuId,
  x: number,
  y: number
): void {
  const menu = Menu.getApplicationMenu()
  const item = menu?.items.find((entry) => {
    const role = String(entry.role ?? '')
    const label = entry.label.replace(/^&/u, '').toLowerCase()
    return role === MENU_ROLES[id] || label === id
  })
  item?.submenu?.popup({ window, x: Math.round(x), y: Math.round(y) })
}
