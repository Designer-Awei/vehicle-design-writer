import { useEffect, useState } from 'react'
import { useWorkspaceBar, WorkspaceActions } from '@renderer/workspace/WorkspaceContext'
import type { DurationProfile, LlmSettings } from '@schemas/index'

/**
 * SiliconFlow、本地存储目录与时长配置。API Key 只通过 IPC 写入主进程。
 */
export function SettingsPage(): React.JSX.Element {
  const [settings, setSettings] = useState<LlmSettings | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [durations, setDurations] = useState<DurationProfile[]>([])
  const [message, setMessage] = useState('')
  const [probing, setProbing] = useState(false)
  const [probeText, setProbeText] = useState('')
  const [probeVision, setProbeVision] = useState('')
  const [stage, setStage] = useState<'model' | 'storage' | 'duration'>('model')

  useWorkspaceBar({
    title: '设置',
    stages: [
      { id: 'model', label: '模型与接口' },
      { id: 'storage', label: '存储' },
      { id: 'duration', label: '时长配置' }
    ],
    activeStage: stage,
    onStageSelect: (id) => {
      if (id === 'model' || id === 'storage' || id === 'duration') setStage(id)
    }
  })

  useEffect(() => {
    void window.api.settings.get().then(setSettings)
    void window.api.settings.getDurations().then(setDurations)
  }, [])

  /**
   * 保存模型与接口配置。
   */
  async function save(): Promise<void> {
    if (!settings) return
    const next = await window.api.settings.save({
      apiKey: apiKey || undefined,
      baseUrl: settings.baseUrl,
      textModel: settings.textModel,
      visionModel: settings.visionModel
    })
    setSettings(next)
    setApiKey('')
    setMessage('已保存。密钥不会出现在渲染进程日志中。')
  }

  /**
   * 拉取 SiliconFlow 模型列表。
   */
  async function loadModels(): Promise<void> {
    try {
      setModels(await window.api.settings.listModels())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * 选择已保存项目所在的根目录。只有主动选择才会记住；恢复默认会跟当前安装目录走。
   */
  async function pickProjectRoot(): Promise<void> {
    setMessage('')
    try {
      const next = await window.api.settings.pickProjectRoot()
      if (!next) return
      setSettings(next)
      setMessage('已改项目存储目录。之后保存会写到这里。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * 恢复成当前安装目录下的 data/projects。
   */
  async function resetProjectRoot(): Promise<void> {
    setMessage('')
    try {
      setSettings(await window.api.settings.resetProjectRoot())
      setMessage('已恢复默认项目目录（当前安装目录 / data / projects）。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * 用资源管理器打开当前项目库。
   */
  async function openProjectRoot(): Promise<void> {
    setMessage('')
    const error = await window.api.settings.openProjectRoot()
    if (error) setMessage(error)
  }

  /**
   * 真实调用文字与视觉接口做连通性测试。
   */
  async function probe(): Promise<void> {
    setProbing(true)
    setProbeText('')
    setProbeVision('')
    setMessage('')
    try {
      const result = await window.api.settings.probe()
      setProbeText(
        result.text.ok
          ? `${result.text.model} · ${result.text.durationMs}ms · ${result.text.preview}`
          : `失败：${result.text.error}`
      )
      setProbeVision(
        result.vision.ok
          ? `${result.vision.model} · ${result.vision.durationMs}ms · ${result.vision.preview}`
          : `失败：${result.vision.error}`
      )
      setMessage(
        result.text.ok && result.vision.ok
          ? '真实文字与视觉接口均调用成功。'
          : '真实调用已发出，请查看分项结果。'
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setProbing(false)
    }
  }

  if (!settings) return <div className="page-fill text-sm text-[#9a8f82]">加载中…</div>

  return (
    <div className="page-fill">
      <WorkspaceActions>
        {stage === 'model' ? (
          <>
            <button className="btn-primary px-3 py-1.5 text-sm" onClick={() => void save()}>
              保存
            </button>
            <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => void loadModels()}>
              拉取模型列表
            </button>
            <button className="btn-ghost px-3 py-1.5 text-sm" disabled={probing} onClick={() => void probe()}>
              {probing ? '正在真实调用…' : '测试文字与图片接口'}
            </button>
          </>
        ) : null}
      </WorkspaceActions>
      {stage === 'model' ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3 rounded-2xl border border-[#2a241e] bg-[#161310] p-5">
            <div className="text-sm text-[#9a8f82]">Provider</div>
            <div>SiliconFlow（OpenAI-compatible）</div>
            <div className="text-sm text-[#9a8f82]">API Key 状态</div>
            <div>
              {settings.hasApiKey ? '已配置（主进程安全存储）' : '未配置，当前为 Demo Mode / MockLLM'}
            </div>
            <input
              className="w-full rounded bg-[#0c0b0a] px-3 py-2"
              type="password"
              placeholder="更新 API Key（留空则保持原值）"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="space-y-3 rounded-2xl border border-[#2a241e] bg-[#161310] p-5">
            <label className="block text-sm text-[#9a8f82]">
              Base URL
              <input
                className="mt-1.5 w-full rounded bg-[#0c0b0a] px-3 py-2"
                value={settings.baseUrl}
                onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
              />
            </label>
            <label className="block text-sm text-[#9a8f82]">
              Text Model
              <input
                className="mt-1.5 w-full rounded bg-[#0c0b0a] px-3 py-2"
                value={settings.textModel}
                onChange={(e) => setSettings({ ...settings, textModel: e.target.value })}
              />
            </label>
            <label className="block text-sm text-[#9a8f82]">
              Vision Model
              <input
                className="mt-1.5 w-full rounded bg-[#0c0b0a] px-3 py-2"
                value={settings.visionModel}
                onChange={(e) => setSettings({ ...settings, visionModel: e.target.value })}
              />
            </label>
          </div>
          {models.length > 0 ? (
            <div className="col-span-2 max-h-40 overflow-auto rounded-2xl border border-[#2a241e] bg-[#161310] p-4 text-xs text-[#9a8f82]">
              {models.join(' · ')}
            </div>
          ) : null}
          {probeText ? <div className="text-sm text-[#cfc3b5]">文字：{probeText}</div> : null}
          {probeVision ? <div className="text-sm text-[#cfc3b5]">视觉：{probeVision}</div> : null}
          {message && stage === 'model' ? (
            <div className="col-span-2 text-sm text-[#c4a574]">{message}</div>
          ) : null}
        </div>
      ) : stage === 'storage' ? (
        <div className="max-w-3xl space-y-4">
          <section className="space-y-4 rounded-2xl border border-[#2a241e] bg-[#161310] p-5 text-sm">
            <div className="text-[#c4a574]">项目存储</div>
            <p className="leading-6 text-[#9a8f82]">
              点击保存后，会在这个目录下按标题新建项目文件夹（参考图 + 项目.json）。默认始终跟当前安装目录走：安装目录/data/projects。
            </p>
            <label className="block text-[#9a8f82]">
              当前目录
              <input
                className="mt-1.5 w-full rounded bg-[#0c0b0a] px-3 py-2 text-[#f3ece1]"
                value={settings.projectRoot}
                readOnly
              />
            </label>
            <p className="text-xs leading-5 text-[#9a8f82]">
              默认：{settings.defaultProjectRoot}
              {settings.projectRoot === settings.defaultProjectRoot ? '（正在使用）' : ''}
              。只有点「选择目录」才会记住自定义路径；「恢复默认」会清掉记忆，继续跟当前安装目录走。
            </p>
            <div className="storage-actions">
              <button type="button" className="btn-primary px-3 py-1.5 text-sm" onClick={() => void pickProjectRoot()}>
                选择目录
              </button>
              <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={() => void resetProjectRoot()}>
                恢复默认
              </button>
              <button type="button" className="btn-ghost px-3 py-1.5 text-sm" onClick={() => void openProjectRoot()}>
                打开目录
              </button>
            </div>
          </section>
          {message ? <div className="text-sm text-[#c4a574]">{message}</div> : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#2a241e] bg-[#161310] p-5 text-sm">
          <div className="mb-3 text-[#c4a574]">时长配置</div>
          <div className="grid grid-cols-3 gap-3">
            {durations.map((item) => (
              <div key={item.id} className="rounded-xl bg-[#0c0b0a] p-4">
                <div>{item.name}</div>
                <div className="mt-1 text-[#9a8f82]">
                  {item.wordsPerMinute} 字/分钟 · 容差 ±{item.tolerancePercent}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
