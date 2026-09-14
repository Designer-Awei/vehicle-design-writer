import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, PenTool, Settings2 } from 'lucide-react'
import { AppErrorBoundary } from '@renderer/components/AppErrorBoundary'
import { AppTitleBar } from '@renderer/components/AppTitleBar'
import { WorkspaceBar } from '@renderer/components/WorkspaceBar'
import { isPrimaryActive } from '@renderer/navigation'
import { WorkspaceProvider } from '@renderer/workspace/WorkspaceContext'

const links = [
  { to: '/', label: '首页', icon: Home },
  { to: '/workbench', label: '文案工作台', icon: PenTool },
  { to: '/settings', label: '设置', icon: Settings2 }
]

/**
 * 应用壳层：Windows 深色顶栏 + 左侧一级菜单 + 工作区顶栏。
 */
export function Layout(): React.JSX.Element {
  const { pathname } = useLocation()
  const overlayTitlebar = window.api.platform === 'win32'

  return (
    <WorkspaceProvider>
      <div className="app-shell">
        {overlayTitlebar ? <AppTitleBar /> : null}
        <div className="app-body">
          <aside className="app-sidebar">
            <div className="app-brand">
              <div className="app-brand-kicker">VEHICLE DESIGN</div>
              <div className="app-brand-name">汽车设计文案助手</div>
            </div>
            <nav className="app-nav">
              {links.map((link) => {
                const Icon = link.icon
                const active = isPrimaryActive(pathname, link.to)
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === '/'}
                    className={() => `nav-link${active ? ' nav-link-active' : ''}`}
                  >
                    <Icon size={16} />
                    {link.label}
                  </NavLink>
                )
              })}
            </nav>
            <div className="app-sidebar-foot">PFDBI</div>
          </aside>
          <div className="app-workspace">
            <WorkspaceBar />
            <main className="app-main">
              <AppErrorBoundary key={pathname}>
                <Outlet />
              </AppErrorBoundary>
            </main>
          </div>
        </div>
      </div>
    </WorkspaceProvider>
  )
}
