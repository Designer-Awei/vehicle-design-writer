import { FileOutput, ImagePlus, ListChecks, PenLine, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useWorkspaceBar } from '@renderer/workspace/WorkspaceContext'

const GUIDE_STEPS = [
  {
    title: '创建选题',
    description: '先写清这期要回答什么，初步想法和事实补充可以后补。',
    icon: PenLine
  },
  {
    title: '准备视觉素材',
    description: '上传车型图，标主分析车型或其他车型，写上车型标签和比较说明。',
    icon: ImagePlus
  },
  {
    title: '对照看图写 PFDBI',
    description: '在设计分析页双图对照，按 P/F/D/B/I 写下人眼观察。',
    icon: ListChecks
  },
  {
    title: '写初稿并核对字数',
    description: '在初稿页写正文，用标题、内容类型和预期时长做辅助检查。',
    icon: Sparkles
  },
  {
    title: '改到能发再导出',
    description: '点保存写入项目库；导出时把当前项目文件夹打成 zip 安装包，自选保存地址。',
    icon: FileOutput
  }
] as const

/**
 * 首页：不重复业务列表，只展示清晰的软件使用路径。
 */
export function HomePage(): React.JSX.Element {
  useWorkspaceBar({ title: '首页' })

  return (
    <div className="guide-page">
      <section className="guide-hero">
        <div className="guide-eyebrow">快速上手</div>
        <h2>从选题、看图到自己写初稿</h2>
        <p>在工作台一篇篇写，直接积累自己的文案风格。不再单独维护风格库。</p>
        <div className="guide-actions">
          <Link to="/workbench/new" className="btn-primary px-4 py-2">
            新建文案
          </Link>
          <Link to="/workbench" className="btn-secondary px-4 py-2">
            打开工作台
          </Link>
        </div>
      </section>

      <section>
        <div className="guide-section-heading">
          <div>
            <h3>推荐使用流程</h3>
            <p>选题想法 → 视觉素材 → 设计分析 → 初稿文案。</p>
          </div>
        </div>
        <ol className="guide-steps">
          {GUIDE_STEPS.map((step, index) => {
            const Icon = step.icon
            return (
              <li key={step.title} className="guide-step">
                <div className="guide-step-number">{String(index + 1).padStart(2, '0')}</div>
                <div className="guide-step-icon">
                  <Icon size={20} />
                </div>
                <div>
                  <h4>{step.title}</h4>
                  <p>{step.description}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="guide-principles">
        <div>
          <span>视觉素材</span>
          <strong>看见什么</strong>
          <p>车型图、角色和比较说明，作为对照看图的证据。</p>
        </div>
        <div>
          <span>PFDBI</span>
          <strong>讲什么</strong>
          <p>人眼观察后写下事实、推断和判断。</p>
        </div>
        <div>
          <span>初稿</span>
          <strong>怎么说</strong>
          <p>自己写正文，用时长和字数检查节奏。</p>
        </div>
      </section>
    </div>
  )
}
