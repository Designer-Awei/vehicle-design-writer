import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { ProjectNewPage } from './pages/ProjectNewPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { SettingsPage } from './pages/SettingsPage'
import { WorkbenchPage } from './pages/WorkbenchPage'

/**
 * 渲染进程路由。风格库入口已下线。
 */
function App(): React.JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/workbench" element={<ProjectsPage />} />
          <Route path="/workbench/new" element={<ProjectNewPage />} />
          <Route path="/workbench/:id" element={<WorkbenchPage />} />
          <Route path="/styles/*" element={<Navigate to="/workbench" replace />} />
          <Route path="/projects" element={<Navigate to="/workbench" replace />} />
          <Route path="/projects/new" element={<Navigate to="/workbench/new" replace />} />
          <Route path="/projects/:id" element={<LegacyProjectRedirect />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

/**
 * 兼容旧项目详情链接，统一迁移到文案工作台路由。
 */
function LegacyProjectRedirect(): React.JSX.Element {
  const { id } = useParams()
  return <Navigate to={id ? `/workbench/${id}` : '/workbench'} replace />
}

export default App
