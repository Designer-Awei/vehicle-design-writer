import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Clapperboard, Home, PenTool, Settings2 } from 'lucide-react'
import { WorkspaceBar } from '@renderer/components/WorkspaceBar'
import { isPrimaryActive } from '@renderer/navigation'
import { WorkspaceProvider } from '@renderer/workspace/WorkspaceContext'

const links = [
  { to: '/', label: '首页', icon: Home },
  { to: '/workbench', label: '文案工作台', icon: PenTool },
  { to: '/styles', label: '风格库', icon: Clapperboard },
  { to: '/settings', label: '设置', icon: Settings2 }
]

/**
 * 应用壳层：左侧一级菜单 + 工作区顶栏二级进度 + 铺满横向的主区。
 */
export function Layout(): React.JSX.Element {
  const { pathname } = useLocation()

  return (
    <WorkspaceProvider>
      <div className="app-shell">
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
          <div className="app-sidebar-foot">PFDBI · DNA</div>
        </aside>
        <div className="app-workspace">
          <WorkspaceBar />
          <main className="app-main">
            <Outlet />
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  )
}
