export const PFDBI_V1 = {
  id: 'pfdbi-v1',
  name: 'PFDBI',
  chain: '设计事实 → 审美感受 → 设计判断',
  forbidden: ['把个人偏好直接写成客观结论', '虚构未确认的品牌车型年份', '为了凑齐五维而编造证据'],
  dimensions: [
    {
      key: 'P',
      name: 'Proportion',
      title: '比例与姿态',
      asks: [
        '前轮位置、轴距、前后悬如何影响姿态',
        '轮径与车身高度的关系',
        '座舱位置如何改变视觉重心'
      ]
    },
    {
      key: 'F',
      name: 'Form',
      title: '形体与型面',
      asks: ['主体量如何组织', '肩部、侧面曲面形成什么张力', '型面是光洁还是破碎']
    },
    {
      key: 'D',
      name: 'Detail',
      title: '图形与细节',
      asks: ['灯组图形强化还是破坏整体', '进气口/前脸图形是否成为锚点', '装饰件是否变成视觉噪音']
    },
    {
      key: 'B',
      name: 'Brand / Brief',
      title: '品牌与产品任务',
      asks: ['产品想表达什么', '造型是否服务这个任务', '不能把品牌口号当成观察']
    },
    {
      key: 'I',
      name: 'Innovation',
      title: '创新与辨识度',
      asks: ['有没有新的体量关系', '还是只在灯效和贴花上创新', '记忆点是否可被复述']
    }
  ]
}

export function frameworkPromptBlock(): string {
  return JSON.stringify(PFDBI_V1, null, 2)
}
