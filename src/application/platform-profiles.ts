import type { PlatformProfile } from '@schemas/index'

export const DEFAULT_PLATFORMS: PlatformProfile[] = [
  {
    platform: 'B站',
    contentLength: '中长口播，允许完整论证',
    hookDensity: '前 8 秒给现象',
    informationDensity: '高，可讲设计逻辑',
    paragraphLength: '适合口播换气的短段',
    ctaStyle: '提问讨论',
    titleStyle: '现象+判断'
  },
  {
    platform: '抖音',
    contentLength: '短，信息前置',
    hookDensity: '第一句必须抓人',
    informationDensity: '中，只保留一个主判断',
    paragraphLength: '极短句',
    ctaStyle: '追问或关注',
    titleStyle: '冲突感短标题'
  },
  {
    platform: '小红书',
    contentLength: '中短，分点清晰',
    hookDensity: '封面句强',
    informationDensity: '中高，适合清单',
    paragraphLength: '短段落+小标题',
    ctaStyle: '收藏/你怎么看',
    titleStyle: '痛点词+设计词'
  },
  {
    platform: 'YouTube',
    contentLength: '长视频可展开比较',
    hookDensity: '开场承诺本集会解决什么',
    informationDensity: '高',
    paragraphLength: '段落可稍长',
    ctaStyle: 'subscribe + 下一集预告',
    titleStyle: '搜索友好的设计问题'
  },
  {
    platform: 'X',
    contentLength: '极短线程',
    hookDensity: '第一条就是结论',
    informationDensity: '高压缩',
    paragraphLength: '一条一个点',
    ctaStyle: '转评提问',
    titleStyle: '不需要长标题'
  }
]
