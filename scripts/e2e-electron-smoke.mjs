/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'

const port = Number(process.env.ELECTRON_DEBUG_PORT || 9223)
const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) =>
  response.json()
)
const page = targets.find((target) => target.type === 'page')
assert(page, '未找到 Electron 渲染进程')

const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

let requestId = 0
const pending = new Map()
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (!message.id) return
  const request = pending.get(message.id)
  if (!request) return
  pending.delete(message.id)
  if (message.error) request.reject(new Error(message.error.message))
  else request.resolve(message.result)
})

/**
 * 发送 Chrome DevTools Protocol 请求。
 */
function send(method, params = {}) {
  const id = ++requestId
  socket.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
}

/**
 * 在 Electron 渲染进程中执行并等待异步 JavaScript。
 */
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  })
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text)
  }
  return result.result.value
}

/**
 * 等待页面条件成立。
 */
async function waitFor(expression, timeoutMs = 5000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(expression)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`等待超时：${expression}`)
}

let projectId
try {
  const shell = await evaluate(`({
    title: document.title,
    background: getComputedStyle(document.body).backgroundColor,
    topPadding: getComputedStyle(document.querySelector('.app-shell')).paddingTop
  })`)
  assert.equal(shell.title, '汽车设计文案助手')
  assert.equal(shell.background, 'rgb(12, 11, 10)')
  assert.equal(shell.topPadding, '32px')

  await evaluate(`location.hash = '#/workbench'`)
  await waitFor(
    `document.body.textContent.includes('已有项目') || document.body.textContent.includes('还没有项目')`
  )
  assert.equal(await evaluate(`document.body.textContent.includes('风格库')`), false)

  projectId = await evaluate(`window.api.projects.create({
    topic: '端到端测试：主分析车型与对标车型的设计差异',
    draft: '',
    platform: 'B站',
    durationSeconds: 300,
    contentType: '车型解读',
    styleId: null,
    imagePaths: ['D:\\\\AI_project\\\\vehicle-design-writer\\\\resources\\\\icon.png']
  }).then(project => project.id)`)
  assert.match(projectId, /^proj_/)

  await evaluate(`location.hash = '#/workbench/${projectId}'`)
  await waitFor(`document.body.textContent.includes('选题想法')`)
  const tabs = await evaluate(
    `[...document.querySelectorAll('.workbench-rail button')].map((node) => node.textContent.trim())`
  )
  assert.deepEqual(tabs, ['选题想法', '视觉素材', '设计分析', '初稿文案'])

  await evaluate(
    `[...document.querySelectorAll('.workbench-rail button')].find((node) => node.textContent.includes('视觉素材')).click(); true`
  )
  await waitFor(`Boolean(document.querySelector('.image-evidence-card'))`)

  await evaluate(
    `[...document.querySelectorAll('.workbench-rail button')].find((node) => node.textContent.includes('设计分析')).click(); true`
  )
  await waitFor(`document.body.textContent.includes('P 比例姿态')`)

  await evaluate(
    `[...document.querySelectorAll('.workbench-rail button')].find((node) => node.textContent.includes('初稿文案')).click(); true`
  )
  await waitFor(`document.body.textContent.includes('预期时长')`)
  assert.equal(await evaluate(`document.body.textContent.includes('预览并添加矩形标注')`), false)

  await evaluate(
    `[...document.querySelectorAll('.workbench-rail button')].find((node) => node.textContent.includes('视觉素材')).click(); true`
  )
  await waitFor(`Boolean(document.querySelector('.image-evidence-card'))`)
  assert.equal(await evaluate(`Boolean(document.querySelector('.annotation-draw-layer'))`), false)

  const saved = await evaluate(`window.api.projects.savePfdbi('${projectId}', {
    topic: '端到端测试：主分析车型与对标车型的设计差异',
    coreQuestion: '主分析车型和对标车型差在哪',
    targetAudience: '',
    P: { observations: ['姿态更低'], evidence: [], interpretation: '', aestheticEffect: '', judgement: '姿态更低', applicable: true },
    F: { observations: [], evidence: [], interpretation: '', aestheticEffect: '', judgement: '', applicable: false },
    D: { observations: [], evidence: [], interpretation: '', aestheticEffect: '', judgement: '', applicable: false },
    B: { observations: [], evidence: [], interpretation: '', aestheticEffect: '', judgement: '', applicable: false },
    I: { observations: [], evidence: [], interpretation: '', aestheticEffect: '', judgement: '', applicable: false },
    aestheticKeywords: [],
    comparisons: [],
    peerComparisons: [],
    verticalComparisons: [],
    horizontalComparisons: [],
    counterArguments: [],
    facts: [],
    inferences: [],
    personalPreferences: [],
    coreConclusion: '姿态更低',
    contentOutline: []
  }).then((project) => project.pfdbi?.P?.judgement)`)
  assert.equal(saved, '姿态更低')

  const afterDraft = await evaluate(`window.api.projects.update('${projectId}', {
    title: '端到端测试标题',
    contentType: '车型解读',
    durationSeconds: 180,
    finalScript: '这是一篇用来核对字数的初稿正文。'
  })`)
  assert.equal(afterDraft.title, '端到端测试标题')
  assert.equal(afterDraft.durationSeconds, 180)
  assert.ok(afterDraft.finalDraft?.script.includes('核对字数'))
  assert.ok(afterDraft.pfdbi?.P?.judgement)

  console.log(
    JSON.stringify(
      {
        passed: true,
        checks: [
          '侧栏不再出现风格库',
          '项目内纵向四标签',
          '视觉素材卡且无框选标注',
          '设计分析 PFDBI 标签',
          '初稿时长检查',
          '人写 PFDBI 可保存',
          '保存初稿不丢 PFDBI'
        ]
      },
      null,
      2
    )
  )
} finally {
  if (projectId) {
    await evaluate(`window.api.projects.remove('${projectId}')`).catch(() => undefined)
  }
  socket.close()
}
