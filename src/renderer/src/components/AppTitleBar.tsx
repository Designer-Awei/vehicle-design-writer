import type { MouseEvent } from 'react'
import appIcon from '@renderer/assets/app-icon.png'

const MENUS = [
  { id: 'file', label: 'File' },
  { id: 'edit', label: 'Edit' },
  { id: 'view', label: 'View' },
  { id: 'window', label: 'Window' },
  { id: 'help', label: 'Help' }
] as const

/**
 * Windows 深色顶栏：图标 + 默认菜单，右侧把位置留给系统最小化/最大化/关闭。
 */
export function AppTitleBar(): React.JSX.Element {
  /**
   * 在按钮下方弹出主进程里的 File / Edit 等系统菜单。
   */
  function openMenu(
    id: (typeof MENUS)[number]['id'],
    event: MouseEvent<HTMLButtonElement>
  ): void {
    const rect = event.currentTarget.getBoundingClientRect()
    void window.api.menu.popup(id, rect.left, rect.bottom)
  }

  return (
    <header className="app-titlebar">
      <img className="app-titlebar-icon" src={appIcon} alt="汽车设计文案助手" draggable={false} />
      <span className="app-titlebar-name">汽车设计文案助手</span>
      <nav className="app-titlebar-menus" aria-label="应用菜单">
        {MENUS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="app-titlebar-menu"
            onClick={(event) => openMenu(item.id, event)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  )
}
