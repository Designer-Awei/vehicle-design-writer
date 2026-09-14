import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
}

/**
 * 捕获页面渲染错误，避免整窗黑屏后无法点回侧栏。
 */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="page-fill">
        <h2 className="text-lg font-semibold">这一页打不开</h2>
        <p className="mt-2 text-sm text-[#9a8f82]">{this.state.error.message}</p>
        <div className="mt-4 flex gap-3">
          <Link to="/workbench" className="btn-primary px-4 py-2 text-sm">
            返回文案工作台
          </Link>
          <Link to="/" className="btn-secondary px-4 py-2 text-sm">
            回到首页
          </Link>
        </div>
      </div>
    )
  }
}
