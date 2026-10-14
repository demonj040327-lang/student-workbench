import type { Course, Question } from './data';

/**
 * 人工核对用户本地四门课的预设内容；不是上传后的 AI 自动生成结果。
 * PDF sourcePage 使用阅读器中从 1 起的页面序号；与幻灯片内部编号可能不同。
 * 原课件只用于本地演示，不应随公开部署上传。
 */
export const courses: Course[] = [
  { id: 'hci', name: 'Human–Computer Interaction', subject: '人机交互', code: 'HCI', color: '#7a875e', materialName: 'week-2-lecture.pdf', topic: 'Week 2 · 用户研究方法与伦理' },
  { id: 'cgr', name: 'Computer Graphics Rendering', subject: '计算机图形学与渲染', code: 'CGR', color: '#5f8195', materialName: 'CGR25_L3.pptx', topic: 'Lecture 3 · Cameras' },
  { id: 'aml', name: 'Applied Machine Learning', subject: '应用机器学习', code: 'AML', color: '#a47756', materialName: 'W01L02-classification.pdf', topic: 'Week 1 · Introduction to Classification' },
  { id: 'mlp', name: 'Machine Learning Practical', subject: '机器学习实践', code: 'MLP', color: '#85719a', materialName: 'mlp03-mlp(1).pdf', topic: 'Deep Neural Networks (1)' },
];

export const courseMaterials: Record<string, { id: string; name: string; originalPath: string; url: string; type: string }[]> = {
  hci: [{ id: 'hci-lecture', name: 'week-2-lecture.pdf', originalPath: '/Users/jiangge/Desktop/爱丁堡 AI/Human-Computer Interaction/Lecture/week-2-lecture.pdf', url: '/course-materials/hci-week-2.pdf', type: 'application/pdf' }],
  cgr: [
    { id: 'cgr-lecture', name: 'CGR25_L3.pptx · 原始幻灯片', originalPath: '/Users/jiangge/Desktop/爱丁堡 AI/Computer Graphics Rendering/Lecture/CGR25_L3.pptx', url: '/course-materials/cgr-lecture-3.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
    { id: 'cgr-notes', name: 'CGR25NotesL3.pdf · 辅助讲义', originalPath: '/Users/jiangge/Desktop/爱丁堡 AI/Computer Graphics Rendering/Notes/CGR25NotesL3.pdf', url: '/course-materials/cgr-lecture-3-notes.pdf', type: 'application/pdf' },
  ],
  aml: [{ id: 'aml-lecture', name: 'W01L02-classification.pdf', originalPath: '/Users/jiangge/Desktop/爱丁堡 AI/Applied Machine Learning/Week1/W01L02-classification.pdf', url: '/course-materials/aml-week-1-classification.pdf', type: 'application/pdf' }],
  mlp: [{ id: 'mlp-lecture', name: 'mlp03-mlp(1).pdf', originalPath: '/Users/jiangge/Desktop/爱丁堡 AI/Machine Learning Practical/Lecture/mlp03-mlp(1).pdf', url: '/course-materials/mlp-deep-networks-1.pdf', type: 'application/pdf' }],
};

export const questions: Record<string, Question[]> = {
  hci: [
    {
      id: 'hci-methods-triangulation', title: '为什么组合研究方法？', minutes: 3,
      prompt: '课件用 triangulation 说明组合不同方法。它的主要目的是什么？',
      options: ['确保每种方法得到完全相同的答案', '从不同角度更深入理解用户体验', '尽量增加问卷数量，替代与用户接触'], answer: 1,
      explanation: '课件第 15 页强调，通过组合不同方法获得对体验的深入理解。方法关注的方面可能不同；组合不意味着结果必须一致。',
      source: 'week-2-lecture.pdf · PDF 第 15 页：Why Use (Different) Methods?',
      sourceId: 'hci-lecture', sourcePage: 15,
      excerpt: '不同方法可从用户表达、行为和体验等角度互相补充，以更深入地理解体验。这里是中文概括，不是原文逐字复制。',
    },
    {
      id: 'hci-semi-structured', title: '选择半结构化访谈', minutes: 4,
      prompt: '已了解研究主题的关键领域，但不确定参与者会如何回答。根据课件，哪种安排最符合半结构化访谈？',
      options: ['准备覆盖关键主题的宽松提纲，并允许适当追问', '严格逐字读取问题，全程不追问', '不准备任何主题，也不记录研究目标'], answer: 0,
      explanation: '第 20 页描述了这种情境：能预测关键领域，但不能预测具体回答。半结构化访谈用宽松提纲覆盖主题，允许追问；仍可能因提纲约束而遗漏想法。',
      source: 'week-2-lecture.pdf · PDF 第 20 页：Semi-Structured Interviews',
      sourceId: 'hci-lecture', sourcePage: 20,
      excerpt: '半结构化访谈在关键主题与灵活追问之间取得平衡，适用于有一定主题知识、又需要探索回答的情境。',
    },
    {
      id: 'hci-respect-consent', title: '参与者拥有选择权', minutes: 4,
      prompt: '根据 Respect for persons，邀请参与者加入研究时，应优先做到哪一点？',
      options: ['研究者认为有益，就可以替参与者决定', '事后才说明研究目的，避免影响参加率', '说明参与相关的风险与收益，尊重自愿选择并取得适当知情同意'], answer: 2,
      explanation: '第 54 页将自愿参与、知情同意和个体自主权列为尊重人的核心内容。研究者的判断不能替代参与者的选择；具体研究还需遵循相应伦理审批要求。',
      source: 'week-2-lecture.pdf · PDF 第 54 页：Respect for persons',
      sourceId: 'hci-lecture', sourcePage: 54,
      excerpt: '参与应出于自愿和知情同意，尊重个人自主权，并让参与者了解相关风险与收益。',
    },
  ],
  cgr: [
    {
      id: 'cgr-depth-projection', title: '深度为何影响画面？', minutes: 3,
      prompt: '在虚拟针孔模型中，使用相机坐标，固定 f 和 X，令正深度 Z 翻倍。投影横坐标 x = fX/Z 会怎样变化？',
      options: ['变为原来的两倍', '变为原来的一半', '保持不变'], answer: 1,
      explanation: '深度在分母。在其他条件不变且 Z > 0 时，将 Z 翻倍会使 x 减半。这是虚拟成像平面的相机坐标约定，不能把世界坐标直接代入而忽略相机变换。',
      source: 'CGR25_L3.pptx · 幻灯片 26–28；CGR25NotesL3.pdf · PDF 第 2 页 §2.3',
      sourceId: 'cgr-notes', sourcePage: 2,
      excerpt: '针孔投影在相机坐标中满足 x = fX/Z、y = fY/Z；齐次坐标经第三分量归一化后得到二维位置。',
    },
    {
      id: 'cgr-intrinsic-extrinsic', title: '内参与外参各管什么？', minutes: 4,
      prompt: '在相机投影矩阵 P = K[R|t] 中，哪一个部分把世界坐标变换到相机坐标？',
      options: ['内参矩阵 K', '只由图像宽度决定', '外参 [R|t]'], answer: 2,
      explanation: '外参中的旋转 R 与平移 t 实现世界到相机的变换。内参 K 描述到像素坐标的映射，包括以像素计的焦距、主点和斜切参数。两者作用不同。',
      source: 'CGR25_L3.pptx · 幻灯片 29–31；CGR25NotesL3.pdf · PDF 第 2 页 §2.2–2.5',
      sourceId: 'cgr-notes', sourcePage: 2,
      excerpt: '外参连接世界与相机坐标；内参连接相机成像与像素表示。完整投影写作 P = K[R|t]。',
    },
    {
      id: 'cgr-aperture-depth', title: '更浅景深如何选择？', minutes: 4,
      prompt: '保持焦距、机位、对焦距离等条件相同，希望背景更虚化。将 f/8 改成 f/2.8，通常会怎样？',
      options: ['光圈直径增大，景深通常更浅', '光圈直径减小，景深通常更深', '光圈不变，只有快门速度改变'], answer: 0,
      explanation: 'f-number N = f/D。固定焦距 f 时，较小 N 对应较大光圈直径 D；控制其他相关条件后，较大光圈通常产生更浅景深。最终曝光还受快门和感光度影响。',
      source: 'CGR25_L3.pptx · 幻灯片 38–39；CGR25NotesL3.pdf · PDF 第 4 页 §4.2–4.3',
      sourceId: 'cgr-notes', sourcePage: 4,
      excerpt: '光圈的 f-number 为焦距除以光圈直径。固定其他条件时，小 f-number 对应大光圈和较浅景深。',
    },
  ],
  aml: [
    {
      id: 'aml-label-space', title: '分类预测的是什么？', minutes: 3,
      prompt: '根据这份分类课件，给定输入特征向量 x，分类任务的输出 y 属于哪一种空间？',
      options: ['任意连续实数，始终没有类别', '只由输入文件大小决定', '一组互斥的类别或标签'], answer: 2,
      explanation: '第 3 页定义：监督学习根据输入特征预测输出；本讲分类的输出空间是一组互斥类别。特征 x 可以是连续值，并不意味着分类标签也是连续值。',
      source: 'W01L02-classification.pdf · PDF 第 3 页：Classification Overview',
      sourceId: 'aml-lecture', sourcePage: 3,
      excerpt: '分类根据输入特征预测类别标签；本课件讨论的类别互斥，区别于预测任意连续数值的任务。',
    },
    {
      id: 'aml-class-prior', title: '先验会影响判断吗？', minutes: 4,
      prompt: '在课件的二分类贝叶斯模型中，某个 x 的两个类条件似然相等且为正，但类别 1 的先验更大。哪一种判断更合理？',
      options: ['类别 1 的后验概率更大', '两类后验一定都是 0.5，先验不起作用', '类别 0 的后验一定更大'], answer: 0,
      explanation: '课件将类条件似然与类别先验相乘，再归一化。两个正似然相等时，更大的先验产生更大的后验；先验表达看到当前观测之前的类别信息。',
      source: 'W01L02-classification.pdf · PDF 第 21 页：Adding Prior Knowledge',
      sourceId: 'aml-lecture', sourcePage: 21,
      excerpt: '分类模型可用类别先验加权类条件似然；二分类的两个先验相加为 1。',
    },
    {
      id: 'aml-bayes-posterior', title: '区分先验与后验', minutes: 4,
      prompt: '在 p(y|x) = p(x|y)p(y)/p(x) 中，哪一项表示观察到 x 后对类别 y 的分布？',
      options: ['p(y)，先验', 'p(y|x)，后验', 'p(x|y)，似然'], answer: 1,
      explanation: '第 26 页将 p(y|x) 标为给定 x 的后验分布。p(y) 是未考虑当前观测时的先验；p(x|y) 是给定类别的观测似然，不能交换条件方向。',
      source: 'W01L02-classification.pdf · PDF 第 26 页：Bayes’ Rule',
      sourceId: 'aml-lecture', sourcePage: 26,
      excerpt: '贝叶斯规则结合似然与先验得到后验，p(x) 作为归一化的证据项。条件方向决定各项含义。',
    },
  ],
  mlp: [
    {
      id: 'mlp-xor-limitation', title: '单层线性模型的限制', minutes: 3,
      prompt: '根据 Learning XOR，为什么单一线性决策边界不能正确区分二维 XOR 的四个点？',
      options: ['XOR 的两类点不能被一条直线分开', '任何有四个点的数据都不能分类', '只要增加同样的训练次数，就一定能让直线完成分离'], answer: 0,
      explanation: 'XOR 将两个对角点分到同一类，另一对角分到另一类，不能用一条直线分开。课件由此说明线性模型的表达限制，不能靠重复训练突破模型形式。',
      source: 'mlp03-mlp(1).pdf · PDF 第 6 页：Learning XOR（页内编号 3/19）',
      sourceId: 'mlp-lecture', sourcePage: 6,
      excerpt: 'XOR 是线性模型能力限制的例子：目标分类无法由单一线性边界表示。',
    },
    {
      id: 'mlp-nonlinear-activation', title: '多一层为何还不够？', minutes: 4,
      prompt: '将两层仿射变换直接相接，没有非线性激活，为什么不能仅凭增加这一层就解决 XOR？',
      options: ['偏置在多层网络中被禁止', '隐藏层只能保存输入，不能计算', '两层仿射变换仍可合成为一个仿射变换，需要非线性激活增加表达能力'], answer: 2,
      explanation: '课件先写出 w(2)(w(1)x+b(1))+b(2)，随后加入非线性激活 a。直接展开仍是对 x 的仿射函数；非线性才使这种结构不再简单合成为一层仿射变换。',
      source: 'mlp03-mlp(1).pdf · PDF 第 15–16 页：Adding layers（页内编号 5/19）',
      sourceId: 'mlp-lecture', sourcePage: 16,
      excerpt: '隐藏层中的非线性激活是关键因素；只叠加仿射变换并不能改变线性决策能力的基本限制。',
    },
    {
      id: 'mlp-relu-output', title: '用 ReLU 做一次计算', minutes: 4,
      prompt: '课件定义 ReLU(x) = max(0, x)。输入分别为 −2 和 3 时，输出依次是什么？',
      options: ['−2 和 3', '0 和 3', '2 和 0'], answer: 1,
      explanation: 'ReLU 保留正输入，并将负输入变为 0。因此 max(0,−2)=0，max(0,3)=3。这里检查函数值，不讨论 x=0 处导数的约定。',
      source: 'mlp03-mlp(1).pdf · PDF 第 38 页：Rectified Linear Unit – ReLU（页内编号 15/19）',
      sourceId: 'mlp-lecture', sourcePage: 38,
      excerpt: 'ReLU 是非线性激活函数，输出为 0 与输入值中的较大者。',
    },
  ],
};

export const coursePlans: Record<string, { title: string; topic: string; source: string; brief: string; steps: { title: string; minutes: number; evidence: string; source: string }[] }> = {
  hci: {
    title: '课后复习 · 用户研究方法与选择权', topic: '研究方法组合、半结构化访谈、知情同意',
    source: 'week-2-lecture.pdf · PDF 第 15、20、54 页',
    brief: '依据真实 HCI Week 2 课件人工编排的个人复习计划；不是学校 coursework 或官方评分要求。分别检查方法组合、访谈提纲与参与者选择权。预计用时由 Demo 提供，可自行调整。',
    steps: [
      { title: '回看方法组合，写下两种方法各关注什么', minutes: 8, evidence: '两条方法特点与一条互补理由', source: 'week-2-lecture.pdf · PDF 第 15 页' },
      { title: '用一句话区分半结构化与结构化访谈', minutes: 8, evidence: '一条比较，含提纲与追问', source: 'week-2-lecture.pdf · PDF 第 20 页' },
      { title: '解释尊重人的原则如何影响研究邀请', minutes: 8, evidence: '自愿、信息与选择权的个人复习笔记', source: 'week-2-lecture.pdf · PDF 第 54 页' },
      { title: '完成三个短关卡，回到原文核对错误点', minutes: 11, evidence: '作答记录与需要复习的概念', source: 'week-2-lecture.pdf · PDF 第 15、20、54 页' },
    ],
  },
  cgr: {
    title: '课后复习 · 相机投影与光圈', topic: '透视除法、内外参、光圈与景深',
    source: 'CGR25_L3.pptx · 幻灯片 26–31、38–39；CGR25NotesL3.pdf · PDF 第 2、4 页',
    brief: '依据真实 Cameras 课件与辅助讲义人工编排的个人复习计划。原 PPTX 共 57 张；辅助讲义共 7 页，两者页码不能对应套用。计划不要求完成课程作业或提交作品。',
    steps: [
      { title: '写出相机坐标下投影公式及适用约定', minutes: 8, evidence: 'x=fX/Z、y=fY/Z 与坐标说明', source: 'CGR25_L3.pptx · 幻灯片 26–28；CGR25NotesL3.pdf · PDF 第 2 页' },
      { title: '说明内参和外参各自连接什么坐标', minutes: 8, evidence: 'K 与 [R|t] 的作用区分', source: 'CGR25_L3.pptx · 幻灯片 29–31；CGR25NotesL3.pdf · PDF 第 2 页' },
      { title: '比较两个 f-number，注明其他固定条件', minutes: 8, evidence: '光圈大小与景深关系的条件化解释', source: 'CGR25_L3.pptx · 幻灯片 38–39；CGR25NotesL3.pdf · PDF 第 4 页' },
      { title: '完成三个短关卡，核对透视与景深的区别', minutes: 11, evidence: '作答记录与个人复习点', source: 'CGR25NotesL3.pdf · PDF 第 2、4 页' },
    ],
  },
  aml: {
    title: '课后复习 · 分类与贝叶斯判断', topic: '类别标签、先验加权、后验分布',
    source: 'W01L02-classification.pdf · PDF 第 3、21、26 页',
    brief: '依据真实 AML Week 1 分类课件人工编排的个人复习计划，只选三个基础模块；没有覆盖完整 81 页讲座，也不等于完成分类课程学习目标。',
    steps: [
      { title: '区分输入特征与分类标签', minutes: 7, evidence: '一条输入与输出空间的说明', source: 'W01L02-classification.pdf · PDF 第 3–4 页' },
      { title: '理解先验如何加入类条件模型', minutes: 9, evidence: '先验加权与归一化的个人笔记', source: 'W01L02-classification.pdf · PDF 第 21 页' },
      { title: '逐项标记贝叶斯公式中的分布含义', minutes: 9, evidence: '先验、似然、后验与证据的区分', source: 'W01L02-classification.pdf · PDF 第 26 页' },
      { title: '完成三个短关卡，核对条件方向', minutes: 11, evidence: '作答记录与混淆点', source: 'W01L02-classification.pdf · PDF 第 3、21、26 页' },
    ],
  },
  mlp: {
    title: '课后复习 · 线性限制与非线性激活', topic: 'XOR、多层仿射变换、ReLU',
    source: 'mlp03-mlp(1).pdf · PDF 第 6、15–16、38 页',
    brief: '依据真实 MLP Deep Neural Networks (1) 课件人工编排的概念复习计划，不写 coursework 答案或训练代码。PDF 含逐步展开页面，阅读器页序与页内 x/19 编号不同。',
    steps: [
      { title: '画出 XOR 点，说明单条直线的限制', minutes: 8, evidence: '四点草图与线性可分性解释', source: 'mlp03-mlp(1).pdf · PDF 第 6 页（页内 3/19）' },
      { title: '展开两层仿射变换，辨认非线性的作用', minutes: 9, evidence: '自己的展开与结构说明', source: 'mlp03-mlp(1).pdf · PDF 第 15–16 页（页内 5/19）' },
      { title: '检查 ReLU 的正负输入输出', minutes: 7, evidence: '两个输入的函数值与解释', source: 'mlp03-mlp(1).pdf · PDF 第 38 页（页内 15/19）' },
      { title: '完成三个短关卡，记录还不清楚的概念', minutes: 11, evidence: '作答记录与下次复习点', source: 'mlp03-mlp(1).pdf · PDF 第 6、16、38 页' },
    ],
  },
};
