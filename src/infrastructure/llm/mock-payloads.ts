import type {
  DocumentAnalysis,
  ExampleCase,
  PFDBIAnalysis,
  QualityReport,
  ScriptDraft,
  StyleProfile,
  StyleQuality,
  StructureTemplate,
  TemplateMatch,
  VisionObservation
} from '@schemas/index'

export const mockVision = (imageId: string): VisionObservation => ({
  imageId,
  viewType: '3/4 front',
  vehicleIdentification: { brand: '车型身份待确认', model: '车型身份待确认', confidence: 0.2 },
  overall: {
    silhouette: '舱体后移，车头视觉更长，整体呈楔形。',
    proportion: '轮径相对车身偏大，姿态更低趴。',
    stance: '四轮外扩，接近地面的视觉重量集中在肩线以下。',
    visualCenterOfGravity: '视觉重心略偏后轴前方。'
  },
  proportion: {
    wheelSize: '轮圈视觉占比偏大。',
    wheelPlacement: '前轮相对前保更靠后，缩短前悬。',
    cabPosition: '座舱后移。',
    frontRearOverhang: '前悬短、后悬中等。',
    bodyHeightWidthRelationship: '宽度感强于高度感。'
  },
  form: {
    majorVolumes: ['发动机舱体量', '座舱玻璃舱', '肩部鼓包'],
    surfacing: ['大面较光洁', '局部硬棱转折'],
    characterLines: ['肩线从前翼子板贯穿至尾灯'],
    shoulder: '肩部厚实，形成宽体感。',
    roofline: '车顶快速下压。',
    wheelArch: '轮眉外扩并与肩部相接。'
  },
  detail: {
    headlamp: '日行灯呈细长图形，灯腔层次未完全确认。',
    taillamp: '尾部横向灯带，具体内部结构不确定。',
    frontGraphic: '前脸封闭趋势明显，进气口被简化。',
    wheelDesign: '多层辐条，细节受分辨率限制。',
    windowGraphic: '侧窗三角窗较小。',
    decorativeElements: ['下部黑色护板', '可能存在镀铬饰条']
  },
  cmf: {
    color: '中性银或浅灰，具体色号不确定。',
    material: '车身主面为高光漆面。',
    finish: '下部件偏哑光。'
  },
  visualHierarchy: {
    primaryFocus: '前脸图形与肩线。',
    secondaryFocus: '轮径与姿态。',
    visualNoise: '下部黑色件可能削弱型面阅读。'
  },
  observations: ['前脸图形高度统一', '姿态依赖大轮径', '肩线是主要型面语言'],
  uncertainties: ['品牌与具体车型无法确认', '真实轴距无法从单图测量', '材质反射可能造成型面误判']
})

export const mockPfdbi = (): PFDBIAnalysis => ({
  topic: '新能源汽车前脸同质化',
  coreQuestion: '为什么很多新能源车前脸看起来越来越像？',
  targetAudience: '关注汽车设计与审美的视频观众',
  P: {
    observations: ['多数车型采用短前悬与舱体后移'],
    evidence: ['参考图中轮距外扩、车头更扁'],
    interpretation: '姿态被优先做成“低趴运动”，比例语言趋于同一配方。',
    aestheticEffect: '第一眼有速度感，但辨识度下降。',
    judgement: '比例策略有效，却容易变成行业默认模板。',
    applicable: true
  },
  F: {
    observations: ['封闭前脸把型面压力集中到灯组和肩线'],
    evidence: ['大面光洁、转折被推到灯具边缘'],
    interpretation: '少了进气口这个传统图形锚点后，前脸只能靠灯具完成识别。',
    aestheticEffect: '干净，但也更容易撞脸。',
    judgement: '型面在服务效率，而不是品牌差异。',
    applicable: true
  },
  D: {
    observations: ['日行灯普遍细长化'],
    evidence: ['横向灯带成为默认图形'],
    interpretation: '细节开始承担本该由整体比例完成的品牌任务。',
    aestheticEffect: '远看像同一套灯语。',
    judgement: '细节创新如果不能服务整体，就会变成贴花。',
    applicable: true
  },
  B: {
    observations: ['新能源产品任务强调科技与运动'],
    evidence: ['用户草稿提到品牌都在追“未来感”'],
    interpretation: '产品任务高度重叠时，设计结论也会重叠。',
    aestheticEffect: '看起来都很新，但缺少家族记忆。',
    judgement: '问题不只在设计师，而在产品定义趋同。',
    applicable: true
  },
  I: {
    observations: ['真正拉开差距的是肩线与侧面比例，而不是灯带'],
    evidence: ['观察中不确定项已标明，未把猜测当事实'],
    interpretation: '创新应落在可被记住的体量关系，而不是新灯效。',
    aestheticEffect: '有记忆点的车仍然靠姿态而不是装饰。',
    judgement: '同质化来自配方复制，不是电动本身。',
    applicable: true
  },
  aestheticKeywords: ['同质化', '封闭前脸', '灯具图形', '姿态配方'],
  comparisons: ['燃油车时代进气口曾是品牌锚点'],
  counterArguments: ['法规与散热需求也会推动前脸封闭，不能全归咎审美惰性'],
  facts: ['参考图可见封闭前脸与细长灯组', '车型身份待确认'],
  inferences: ['灯组被用来补品牌识别'],
  personalPreferences: ['本分析不把“喜不喜欢”当作客观结论'],
  coreConclusion: '新能源前脸变像，是产品任务、姿态配方和灯具图形被同时标准化的结果。',
  contentOutline: [
    '用一个像的瞬间开场',
    '拆比例配方',
    '拆前脸图形',
    '回到品牌任务',
    '给出可记住的判断'
  ]
})

export const mockBaseDraft = (): ScriptDraft => ({
  title: '新能源前脸为什么越来越像',
  outline: [
    '开场提出现象',
    'P 讲姿态配方',
    'F/D 讲前脸与灯组',
    'B 讲产品任务',
    '收束到可验证的判断'
  ],
  script:
    '你有没有发现，很多新能源车远看都像一家人。不是因为电动本身长得像，而是大家在用同一套比例配方：短前悬、舱体后移、再配一条细长灯。进气口消失以后，前脸少了一个传统锚点，识别压力全堆到灯组上。于是灯越做越像签名，签名却越来越像模板。品牌想表达科技和运动，任务一旦重叠，设计结论也会重叠。真正能被记住的，还是侧面肩线和轮距关系，而不是又一条日行灯。车型身份如果没法从图片确认，我们先不编品牌故事，只讲看得到的设计事实。',
  pfdbiReferences: ['P:姿态配方', 'F:封闭前脸', 'D:灯具图形', 'B:产品任务重叠', 'I:记忆点在体量']
})

export const mockStyleProfile = (): StyleProfile => ({
  creator: {
    name: '演示创作者 A（DEMO DATA）',
    platform: 'B站',
    description: '虚构的汽车设计评论口播风格，仅用于产品演示，不是真实博主文案。'
  },
  tone: {
    professionalism: 0.78,
    emotion: 0.62,
    humor: 0.45,
    sarcasm: 0.28,
    warmth: 0.4,
    aggressiveness: 0.22
  },
  language: {
    sentenceLength: '中短句为主，关键判断用短句砸地。',
    rhythm: '先给现象，再拆证据，最后收判断。',
    vocabularyDensity: '设计术语适中，会立刻翻译成观众能看见的画面。',
    technicalTermDensity: '术语服务于观察，不堆砌。',
    metaphorFrequency: '中等，常用“配方”“签名”“锚点”。',
    colloquialism: '口播口语，保留现场感。',
    firstPersonUsage: '中等，用“你有没有发现”。',
    secondPersonUsage: '较高，直接把观众拉进画面。'
  },
  argumentation: {
    opinionVsFact: '观点先行，但立刻补观察。',
    opinionPosition: '开头 10 秒内给判断。',
    evidenceUsage: '用比例、灯组、肩线等可见证据。',
    comparisonFrequency: '常和燃油车时代前脸对比。',
    counterArgumentUsage: '会主动说“也不能全怪设计师”。',
    reversalFrequency: '中段会把责任从造型推到产品任务。'
  },
  rhetoric: {
    hookPatterns: ['你有没有发现……', '远看都像一家人。'],
    transitionPatterns: ['问题不在这里，在……', '把镜头拉到侧面。'],
    reversalPatterns: ['真正决定记忆点的不是灯。'],
    analogyPatterns: ['像同一套配方', '签名写成了模板'],
    endingPatterns: ['记住体量，而不是装饰。'],
    ctaPatterns: ['你觉得更像产品任务，还是审美惰性？']
  },
  automotiveDesign: {
    proportionAnalysis: '先看轮径、前悬、舱体位置。',
    formAnalysis: '再看肩线和大面光洁度。',
    detailAnalysis: '灯组只作为图形证据，不神化。',
    brandAnalysis: '把品牌意图还原成产品任务。',
    innovationAnalysis: '创新要能被记住，而不是新灯效。'
  },
  commercial: {
    sponsoredStyle: '先把设计逻辑讲完，再自然落入车型。',
    integrationPatterns: ['用观察句带出卖点', '不在开头硬广'],
    brandMentionTiming: '中后段。',
    ctaStyle: '提问式收束。'
  },
  signaturePatterns: ['观点先行', '事实/推断分开', '用配方类比喻'],
  avoidPatterns: ['空喊好看难看', '假装认识未确认车型', '堆参数充专业'],
  evidenceReferences: [
    { feature: '观点先行', evidenceReferences: ['doc_demo_1', 'doc_demo_2'] },
    { feature: '把术语翻译成画面', evidenceReferences: ['doc_demo_1', 'doc_demo_3'] }
  ]
})

export const mockTemplates = (): StructureTemplate[] => [
  {
    templateName: '单车型设计深度分析',
    scenario: '围绕一辆车把 PFDBI 走完',
    applicableTopics: ['单车型设计深度分析', '热点设计评论'],
    durationRange: '4-8 分钟',
    sections: [
      {
        name: 'Hook',
        timePercent: 0.08,
        purpose: '抛出现象',
        instruction: '用观众能看见的一句话开场'
      },
      {
        name: 'Context',
        timePercent: 0.12,
        purpose: '限定不编造的部分',
        instruction: '车型身份不确定就明确说'
      },
      {
        name: 'Evidence',
        timePercent: 0.25,
        purpose: 'P/F 观察',
        instruction: '只讲图片上能看到的比例和型面'
      },
      {
        name: 'Analysis',
        timePercent: 0.3,
        purpose: 'D/B 判断',
        instruction: '从图形回到品牌任务'
      },
      { name: 'Reversal', timePercent: 0.1, purpose: '反例', instruction: '承认法规和工程限制' },
      { name: 'Conclusion', timePercent: 0.1, purpose: '收束', instruction: '给一句可记住的判断' },
      { name: 'CTA', timePercent: 0.05, purpose: '提问', instruction: '把争议抛回观众' }
    ]
  },
  {
    templateName: '热点设计评论',
    scenario: '短评论一个设计现象',
    applicableTopics: ['热点设计评论'],
    durationRange: '2-5 分钟',
    sections: [
      { name: 'Hook', timePercent: 0.15, purpose: '抓现象', instruction: '直接说像在哪里' },
      {
        name: 'MainArgument',
        timePercent: 0.45,
        purpose: '给判断',
        instruction: '用一个 PFDBI 维度打穿'
      },
      { name: 'Evidence', timePercent: 0.25, purpose: '补证据', instruction: '举一张图上的事实' },
      { name: 'Conclusion', timePercent: 0.15, purpose: '收', instruction: '短句砸地' }
    ]
  }
]

export const mockExamples = (): ExampleCase[] => [
  {
    sourceDocumentId: 'doc_demo_1',
    scenario: '热点设计评论',
    structure: '现象-证据-反转',
    excerpt: '你有没有发现，很多车远看都像一家人。不是灯坏了，是配方重复了。',
    whyRepresentative: '短句开场，立刻把现象变成判断。'
  },
  {
    sourceDocumentId: 'doc_demo_2',
    scenario: '单车型设计深度分析',
    structure: '比例-型面-品牌任务',
    excerpt: '先看前轮位置。座舱一往后，车头就会被“拉长”，这是姿态，不是装饰。',
    whyRepresentative: '把术语翻译成观众能看见的空间关系。'
  }
]

export const mockDocumentAnalysis = (documentId: string): DocumentAnalysis => ({
  documentId,
  topic: '汽车设计评论',
  structure: ['现象开场', '拆观察', '给判断'],
  languageTraits: ['口播短句', '术语后立刻解释'],
  argumentationTraits: ['观点先行', '主动留反例'],
  signatureLines: ['配方', '签名写成了模板'],
  designKnowledgeVsStyle: '专业术语来自主题，个人风格体现在如何组织这些术语，而不是术语本身。'
})

export const mockQuality = (): QualityReport => ({
  durationScore: 0.92,
  pfdbiCoverage: { P: 0.9, F: 0.86, D: 0.8, B: 0.84, I: 0.78 },
  styleConsistency: 0.88,
  factRisk: ['车型品牌未确认，已标记待核实'],
  genericPhraseRisk: ['未发现空泛“颜值在线”套话'],
  copyRisk: ['DEMO DATA 片段仅作结构参考，未整篇复写'],
  suggestions: ['可再补一个侧面比例的具体观察'],
  completeness: 'PFDBI 五维均有观察与判断'
})

export const mockStyleQuality = (): StyleQuality => ({
  passed: true,
  issues: [],
  revisedNotes: ['结论均能追溯到多篇演示样本，未把汽车术语误当成作者独特性。']
})

export const mockTemplateMatch = (): TemplateMatch => ({
  templateName: '单车型设计深度分析',
  reason: '选题是对一类车型前脸现象的设计评价，适合把 PFDBI 完整走一遍。'
})

export const mockFinalScript = (): ScriptDraft => ({
  title: '新能源前脸为什么越来越像',
  outline: mockBaseDraft().outline,
  script: `你有没有发现，现在很多新能源车远看都像一家人。

不是因为电动天生长得像，而是大家在用同一套配方：短前悬、舱体后移、再加一条细长灯。

进气口没了以后，前脸少了一个传统锚点。识别压力全堆到灯组上，灯就越做越像签名，签名却越写越像模板。

把镜头拉到侧面。真正拉开差距的，往往是肩线和轮距，而不是又一套日行灯。

当然也不能全怪设计师。产品任务都在追科技感和运动感，任务一重叠，结论就会重叠。

所以这件事不是“谁抄谁”，而是行业把姿态和灯语同时标准化了。

车型如果没法从图片确认，我们先不编品牌故事。先把看得到的设计事实讲清楚。

你觉得更像审美惰性，还是产品定义本来就挤在同一条赛道？`,
  pfdbiReferences: mockBaseDraft().pfdbiReferences
})
