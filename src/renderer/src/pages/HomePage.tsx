import { FileOutput, ImagePlus, ListChecks, Palette, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useWorkspaceBar } from '@renderer/workspace/WorkspaceContext'

const GUIDE_STEPS = [
  {
    title: '配置风格模板',
    description: '导入你认可的历史文案，提取语言特征、结构模板与代表性示例。',
    icon: Palette
  },
  {
    title: '创建文案并上传参考图',
    description: '填写选题与初步草稿，上传车型图片，为后续分析提供视觉证据。',
    icon: ImagePlus
  },
  {
    title: '选择内容参数',
    description: '设置发布平台、文案类型、预期时长和风格模板，明确生成边界。',
    icon: ListChecks
  },
  {
    title: '运行分析与生成工作流',
    description: '依次完成视觉观察、PFDBI 设计分析、结构匹配与风格化初稿。',
    icon: Sparkles
  },
  {
    title: '编辑、质检并导出',
    description: '局部改写文案，检查事实风险与时长，保存版本后导出 TXT 或 MD。',
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
        <h2>从设计证据到可发布文案</h2>
        <p>
          先建立风格模板，再用车型参考图和内容参数约束分析，最后按工作流生成、编辑并导出。
        </p>
        <div className="guide-actions">
          <Link to="/styles/new" className="btn-secondary px-4 py-2">
            配置风格
          </Link>
          <Link to="/workbench/new" className="btn-primary px-4 py-2">
            新建文案
          </Link>
        </div>
      </section>

      <section>
        <div className="guide-section-heading">
          <div>
            <h3>推荐使用流程</h3>
            <p>每一步的产出都会成为下一步的输入，避免无依据地直接生成文案。</p>
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
          <span>视觉观察</span>
          <strong>看见什么</strong>
          <p>参考图、矩形标注与可核查的设计细节。</p>
        </div>
        <div>
          <span>PFDBI</span>
          <strong>讲什么</strong>
          <p>将事实、推断和个人偏好分开组织。</p>
        </div>
        <div>
          <span>Style DNA</span>
          <strong>怎么说</strong>
          <p>匹配语言习惯、叙事节奏和结构模板。</p>
        </div>
      </section>
    </div>
  )
}
