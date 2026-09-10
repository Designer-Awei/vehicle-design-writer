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
let styleId
try {
  const shell = await evaluate(`({
    title: document.title,
    background: getComputedStyle(document.body).backgroundColor,
    topPadding: getComputedStyle(document.querySelector('.app-shell')).paddingTop
  })`)
  assert.equal(shell.title, '汽车设计文案助手')
  assert.equal(shell.background, 'rgb(12, 11, 10)')
  assert.equal(shell.topPadding, '32px')

  await evaluate(`location.hash = '#/styles/new'`)
  await waitFor(`document.body.textContent.includes('选择文案文件夹并继续')`)
  assert.equal(await evaluate(`document.body.textContent.includes('保存档案')`), false)

  styleId = await evaluate(`window.api.styles.create({
    name: 'E2E 待删除风格',
    platform: 'B站',
    category: '设计观点',
    notes: '验证删除入口'
  }).then(style => style.id)`)
  const updatedStyle = await evaluate(`window.api.styles.update('${styleId}', {
    category: '车型解读',
    notes: '已切换内容类型'
  })`)
  assert.equal(updatedStyle.category, '车型解读')
  await evaluate(`location.hash = '#/styles'`)
  await waitFor(`document.body.textContent.includes('E2E 待删除风格')`)
  await waitFor(`([...document.querySelectorAll('.style-list-card')].some(node =>
    node.textContent.includes('E2E 待删除风格') && node.textContent.includes('车型解读')
  ))`)
  await evaluate(`(() => {
    const card = [...document.querySelectorAll('.style-list-card')]
      .find(node => node.textContent.includes('E2E 待删除风格'))
    card.querySelector('.style-delete-button').click()
    return true
  })()`)
  await waitFor(`Boolean(document.querySelector('.confirm-dialog .danger-button'))`)
  await evaluate(`document.querySelector('.confirm-dialog .danger-button').click(); true`)
  await waitFor(`!document.body.textContent.includes('E2E 待删除风格')`)
  assert.equal(await evaluate(`window.api.styles.get('${styleId}')`), null)
  styleId = undefined

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
  await waitFor(`Boolean(document.querySelector('.image-evidence-card'))`)

  const gates = await evaluate(`[...document.querySelectorAll('.workspace-stage')].map(node => ({
    label: node.textContent.trim(),
    disabled: node.disabled === true
  }))`)
  assert.equal(gates.find((item) => item.label.includes('PFDBI'))?.disabled, true)
  assert.equal(gates.find((item) => item.label.includes('成稿设置'))?.disabled, true)
  assert.equal(gates.find((item) => item.label.includes('文案编辑'))?.disabled, true)

  await evaluate(`document.querySelector('.image-evidence-actions .btn-ghost').click(); true`)
  await waitFor(`Boolean(document.querySelector('.annotation-draw-layer'))`)
  const rect = await evaluate(`(() => {
    const value = document.querySelector('.annotation-draw-layer').getBoundingClientRect()
    return { x: value.x, y: value.y, width: value.width, height: value.height }
  })()`)
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: rect.x + rect.width * 0.2,
    y: rect.y + rect.height * 0.2,
    button: 'left',
    clickCount: 1
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: rect.x + rect.width * 0.6,
    y: rect.y + rect.height * 0.55,
    button: 'left',
    buttons: 1
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: rect.x + rect.width * 0.6,
    y: rect.y + rect.height * 0.55,
    button: 'left',
    clickCount: 1
  })
  await waitFor(`document.querySelector('.annotation-sidebar .btn-primary')?.disabled === false`)
  await evaluate(`document.querySelector('.annotation-sidebar .btn-primary').click(); true`)
  await waitFor(`document.querySelectorAll('.annotation-list-item').length === 1`)
  assert.equal(await evaluate(`document.querySelector('#annotation-note').value`), '')

  const annotation = await evaluate(
    `window.api.projects.get('${projectId}').then(project => project.images[0].annotations[0])`
  )
  assert.ok(annotation.width > 0.35 && annotation.width < 0.45)
  assert.ok(annotation.height > 0.3 && annotation.height < 0.4)

  await evaluate(`document.querySelector('.annotation-close').click(); true`)
  await waitFor(`!document.querySelector('.annotation-overlay')`)
  await evaluate(`document.querySelector('.icon-danger-button').click(); true`)
  await waitFor(`Boolean(document.querySelector('#delete-reference-image-title'))`)
  assert.equal(
    await evaluate(
      `window.api.projects.get('${projectId}').then(project => project.images.length)`
    ),
    1
  )
  await evaluate(`document.querySelector('.confirm-dialog .btn-secondary').click(); true`)
  await waitFor(`!document.querySelector('#delete-reference-image-title')`)

  const afterVision = await evaluate(`window.api.projects.analyzeVision('${projectId}')`)
  assert.equal(afterVision.visionObservations.length, 1)

  const afterPfdbi = await evaluate(`window.api.projects.analyzePfdbi('${projectId}')`)
  assert.ok(afterPfdbi.pfdbi?.coreConclusion)

  await evaluate(`window.api.projects.update('${projectId}', {
    draft: '先讲视觉证据，再形成设计判断。',
    platform: 'B站',
    durationSeconds: 300,
    contentType: '车型解读',
    styleId: null
  })`)
  const generated = await evaluate(`window.api.projects.generate('${projectId}')`)
  assert.ok(generated.baseDraft?.script)
  assert.ok(generated.finalDraft?.script)
  assert.ok(generated.quality)

  const imageId = generated.images[0].id
  await evaluate(`window.api.projects.saveAnnotation({
    imageId: '${imageId}',
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.2,
    note: '验证下游失效'
  })`)
  const invalidated = await evaluate(`window.api.projects.get('${projectId}')`)
  assert.equal(invalidated.visionObservations.length, 0)
  assert.equal(invalidated.pfdbi, null)
  assert.equal(invalidated.finalDraft, null)

  console.log(
    JSON.stringify(
      {
        passed: true,
        checks: [
          '深色窗口内容与 32px 标题栏覆盖区',
          '风格创建入口无需单独保存档案',
          '风格列表删除与确认',
          '阶段门禁',
          '参考图预览',
          '拖拽矩形标注与坐标持久化',
          '保存标注后自动清空意图',
          '删除参考图二次确认',
          '视觉观察',
          'PFDBI',
          'Base Draft 与最终稿',
          '标注变化触发下游失效'
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
  if (styleId) {
    await evaluate(`window.api.styles.remove('${styleId}')`).catch(() => undefined)
  }
  socket.close()
}
