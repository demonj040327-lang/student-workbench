import {
  loadState,
  defaultSemester,
  mondayOf,
  type Assignment,
  type Course,
  type Semester,
} from './data';
import type { StudyDocument, StudyUnit } from './studyTypes';

export type CampusRole = 'student' | 'teacher';
export type CampusCourse = Course & {
  teacher: string;
  description: string;
  instructorId?: string;
};
export type CampusMaterial = {
  weekUnconfirmed?: boolean;
  kind?: 'lecture' | 'tutorial' | 'reference' | 'template';
  id: string;
  courseId: string;
  title: string;
  week: number;
  name: string;
  status: 'draft' | 'published';
  document: StudyDocument;
  blob?: Blob;
  updatedAt: string;
  example?: boolean;
};
export type CampusData = {
  version: 1;
  courses: CampusCourse[];
  assignments: Assignment[];
  semester: Semester;
};
export type StudentProgress = {
  steps: Record<string, boolean>;
  units: Record<string, boolean>;
  answers: Record<string, { option: number; checked: boolean }>;
  dismissed: string[];
  submitted?: Record<string,string>;
};
export type PersonalApi = { key: string; model: string; provider?: 'elm' | 'deepseek' };
export const emptyProgress = (): StudentProgress => ({
  steps: {},
  units: {},
  answers: {},
  dismissed: [],
});
const prefix = (demo: boolean) =>
  `workbench-campus-${demo ? 'demo' : 'personal'}-v1`;

const courseSeeds: CampusCourse[] = [
  {
    id: 'campus-hci',
    name: '人机交互',
    code: 'HCI',
    subject: 'Design',
    color: '#6f8264',
    teacher: 'Alex Morgan',
    instructorId: 'local-teacher',
    description: '从真实需求出发，设计并验证交互体验。',
  },
  {
    id: 'campus-ml',
    name: '应用机器学习',
    code: 'AML',
    subject: 'Computing',
    color: '#64899b',
    teacher: 'Sam Taylor',
    instructorId: 'teacher-sam',
    description: '理解模型、评估方法与数据驱动的决策。',
  },
  {
    id: 'campus-history',
    name: '文化与历史',
    code: 'HIST',
    subject: 'Humanities',
    color: '#b08962',
    teacher: 'Jamie Lee',
    instructorId: 'teacher-jamie',
    description: '阅读史料，建立有依据的历史论证。',
  },
  {
    id: 'campus-policy',
    name: '环境与公共政策',
    code: 'POL',
    subject: 'Social science',
    color: '#8d7aa2',
    teacher: 'Alex Morgan',
    instructorId: 'local-teacher',
    description: '比较政策工具，分析证据与公共决策。',
  },
];
const titles = [
  '用户研究报告',
  '分类模型实验',
  '史料分析论文',
  '政策比较简报',
  '交互原型与评估',
  '模型评估报告',
];
const steps = [
  [
    '明确研究问题',
    '设计访谈提纲',
    '整理观察与访谈',
    '形成研究发现',
    '检查并提交',
  ],
  [
    '检查数据与划分',
    '建立基线模型',
    '比较评估指标',
    '分析误差',
    '完成实验报告',
  ],
  [
    '确定论点',
    '阅读一手史料',
    '核对背景与立场',
    '完成论证草稿',
    '检查引文与提交',
  ],
  [
    '界定政策问题',
    '收集比较证据',
    '分析政策取舍',
    '撰写政策建议',
    '检查并提交',
  ],
];
export function createCampusData(demo: boolean): CampusData {
  if (!demo) {
    const previous = loadState();
    return {
      version: 1,
      courses: previous.courses.map((c) => ({
        ...c,
        teacher: 'Course team',
        description: '',
      })),
      assignments: previous.assignments.filter(
        (a) => !a.planOnly && a.category !== 'review',
      ),
      semester: previous.semester || defaultSemester,
    };
  }
  return {
    version: 1,
    courses: courseSeeds,
    semester: {
      name: '2026/27 · Semester 1',
      start: '2026-09-21',
      end: '2027-01-15',
    },
    assignments: titles.map((title, i) => ({
      id: `campus-assignment-${i}`,
      courseId: courseSeeds[i % 4].id,
      title,
      startsOn: [
        '2026-10-05',
        '2026-10-12',
        '2026-10-05',
        '2026-10-19',
        '2026-11-02',
        '2026-11-09',
      ][i],
      due: [
        '2026-11-06',
        '2026-10-26',
        '2026-11-13',
        '2026-11-20',
        '2026-12-11',
        '2026-12-18',
      ][i],
      deadlineVerified: true,
      category: 'coursework',
      brief: '课堂演示作业，要求与日期均为示例。',
      steps: steps[i % 4].map((title, j) => ({
        id: `campus-assignment-${i}-step-${j}`,
        title,
        minutes: 30,
        day: j,
        done: i < 4 && j < [2, 3, 1, 0][i],
        blocked: false,
        evidence: '',
        source: '',
      })),
    })),
  };
}
export function loadCampusData(demo: boolean): CampusData {
  try {
    const value = JSON.parse(localStorage.getItem(prefix(demo)) || 'null');
    if (
      value?.version === 1 &&
      Array.isArray(value.courses) &&
      Array.isArray(value.assignments)
    )
      return {
        ...value,
        courses: value.courses.map((course: CampusCourse) => ({
          ...course,
          instructorId:
            course.instructorId ||
            (demo && course.id === 'campus-ml'
              ? 'teacher-sam'
              : demo && course.id === 'campus-history'
                ? 'teacher-jamie'
                : 'local-teacher'),
          ...(demo && course.id === 'campus-policy'
            ? { teacher: 'Alex Morgan' }
            : {}),
        })),
      };
  } catch {
    /* Preserve a usable empty state. */
  }
  return createCampusData(demo);
}
export function saveCampusData(demo: boolean, data: CampusData) {
  localStorage.setItem(prefix(demo), JSON.stringify(data));
}
export function loadCampusProgress(demo: boolean): StudentProgress {
  try {
    const value = JSON.parse(
      localStorage.getItem(`${prefix(demo)}-progress`) || 'null',
    );
    if (
      value &&
      value.steps &&
      value.units &&
      value.answers &&
      Array.isArray(value.dismissed)
    )
      return value;
  } catch {
    /* Use an empty progress ledger. */
  }
  return emptyProgress();
}
export function saveCampusProgress(demo: boolean, progress: StudentProgress) {
  localStorage.setItem(`${prefix(demo)}-progress`, JSON.stringify(progress));
}
export function studentAssignments(
  data: CampusData,
  progress: StudentProgress,
) {
  return data.assignments.filter(a=>!a.coursework || (a.coursework.status === "published" && Date.parse(a.coursework.releaseAt)<=Date.now())).map((a) => ({
    ...a,
    steps: a.steps.map((s) => ({ ...s, done: progress.steps[s.id] ?? s.done })),
  }));
}
export function weekNumber(semester: Semester, day = new Date()) {
  return Math.max(
    1,
    Math.ceil(
      (new Date(mondayOf(day) + 'T12:00:00').getTime() -
        new Date(semester.start + 'T12:00:00').getTime()) /
        604800000,
    ) + 1,
  );
}

const lessons = [
  {
    title: '访谈与研究证据',
    pages: [
      [
        'Research questions',
        'A research question describes what we want to understand about users and their activities. It guides participant selection and the interview topics. A clear question should avoid assuming that a particular interface is better.',
      ],
      [
        'Semi-structured interviews',
        'A semi-structured interview uses a flexible topic guide and follow-up questions. Open questions invite participants to describe concrete experiences. Leading questions can introduce interviewer bias.',
      ],
      [
        'Consent and evidence',
        'Participation is voluntary. Explain the purpose of the study and ask for informed consent. Distinguish direct observations, participant statements, and researcher interpretations when recording evidence.',
      ],
    ],
    units: [
      [
        '明确研究问题',
        '把模糊的设计目标转换成可研究的问题。',
        ['关注用户活动与使用情境', '避免预设某个界面更好'],
        ['阅读第一页的研究问题定义', '用一句话写出希望了解的用户活动'],
        '哪一个研究问题更适合开展访谈？',
        [
          '哪款 App 一定更好？',
          '用户如何调整临时改变的行程？',
          '用户是否应该使用新功能？',
          '怎样证明我的设计正确？',
        ],
        1,
        '关注真实活动的问题允许参与者提供多种经验，不预设结论。',
      ],
      [
        '设计开放式访谈',
        '用主题提纲保持方向，用追问理解具体经历。',
        ['半结构化访谈保留追问空间', '诱导性问题可能引入偏差'],
        ['找出开放问题与诱导问题的区别', '将一个封闭问题改成开放问题'],
        '半结构化访谈的特点是什么？',
        [
          '完全不准备问题',
          '只能按固定顺序提问',
          '使用主题提纲并灵活追问',
          '只允许回答是或否',
        ],
        2,
        '课件第二页说明了灵活的主题提纲和追问。',
      ],
      [
        '区分证据与解释',
        '保留参与者原话，并将自己的解释单独记录。',
        ['参与需要知情同意', '观察、陈述与研究者解释应区分'],
        ['核对知情同意要说明的内容', '为一条访谈摘录分别写事实与解释'],
        '整理访谈时应当怎样记录？',
        [
          '将推测写成参与者观点',
          '只保留符合预期的材料',
          '混合原话与分析以简化记录',
          '区分原话、观察和研究者解释',
        ],
        3,
        '第三页明确要求区分这些不同类型的证据。',
      ],
    ],
  },
  {
    title: '模型评估与数据划分',
    pages: [
      [
        'Data splits',
        'Training data is used to fit model parameters. Validation data supports model selection. Test data is reserved for the final evaluation. Repeatedly choosing models on the test set can produce an optimistic estimate.',
      ],
      [
        'Evaluation metrics',
        'Accuracy is the fraction of correct predictions. Precision measures how many predicted positives are actually positive. Recall measures how many actual positives are detected. The choice of metric depends on the task and the cost of different errors.',
      ],
      [
        'Overfitting',
        'Overfitting occurs when a model fits training-specific patterns that do not generalise well. Compare training and validation performance. Regularisation and a simpler model may help, but improvements must be checked on held-out data.',
      ],
    ],
    units: [
      [
        '正确划分数据',
        '区分训练、验证和测试数据的用途。',
        ['训练集拟合参数', '验证集选择模型', '测试集用于最终评估'],
        ['为三个数据集分别写下用途', '检查实验是否反复使用测试集选模型'],
        '哪一份数据用于模型选择？',
        ['训练集', '验证集', '最终测试集', '全部数据合并'],
        1,
        '验证集支持模型选择，测试集应保留到最终评估。',
      ],
      [
        '选择评估指标',
        '根据任务中不同错误的代价来选择指标。',
        [
          'Accuracy 衡量整体预测正确比例',
          'Precision 与 Recall 关注不同的正类问题',
        ],
        ['比较三个指标的定义', '说明遗漏正类代价较高时要关注什么'],
        'Recall 衡量什么？',
        [
          '预测正类中实际正类的比例',
          '所有预测中正确的比例',
          '实际正类中被检测到的比例',
          '训练样本的总数',
        ],
        2,
        'Recall 关注实际正类有多少被模型检测到。',
      ],
      [
        '识别过拟合',
        '通过训练与验证表现的差异检查泛化。',
        ['训练表现好不代表泛化好', '正则化效果需要独立验证'],
        ['比较训练和验证结果', '提出一个可验证的改进方法'],
        '哪一种情况提示可能过拟合？',
        [
          '训练与验证表现都很差',
          '验证表现稳定提高',
          '模型参数数量减少',
          '训练表现很好，验证表现明显较差',
        ],
        3,
        '过拟合指拟合了训练特有的模式，而不能很好地泛化。',
      ],
    ],
  },
  {
    title: '一手史料的阅读方法',
    pages: [
      [
        'Primary sources',
        'A primary source is evidence produced in the period or activity being studied. Ask who created it, for whom, and for what purpose. A source is not automatically an accurate account of every event it describes.',
      ],
      [
        'Context and perspective',
        'Interpret a source in its historical context. The author has a perspective shaped by their role and intended audience. Absence of a voice in one source does not mean that the group had no role in the event.',
      ],
      [
        'Corroboration',
        'Compare independent sources and account for their differences. An argument should connect claims with specific evidence, explain uncertainty, and acknowledge limitations rather than treating one source as a complete account.',
      ],
    ],
    units: [
      [
        '确认史料身份',
        '先了解谁在何时、为谁、出于什么目的留下材料。',
        ['一手史料来自所研究的时期或活动', '一手不等于完全准确'],
        ['记录作者、受众和目的', '指出一个需要进一步核对的陈述'],
        '阅读一手史料时首先应关注什么？',
        [
          '是否符合自己的观点',
          '作者、受众与创作目的',
          '文字是否足够长',
          '是否提供唯一正确结论',
        ],
        1,
        '第一页提出了作者、受众与目的三个阅读问题。',
      ],
      [
        '识别立场与语境',
        '把史料放回其产生的情境中理解。',
        ['作者的角色影响其视角', '材料缺失某种声音不能直接证明其不存在'],
        ['找出作者的角色', '思考哪些群体的声音没有被记录'],
        '材料没有记载某群体意味着什么？',
        [
          '群体一定没有参与',
          '无需研究该群体',
          '需要更多证据才能判断',
          '作者一定说谎',
        ],
        2,
        '课件强调，声音缺失不能直接推导出群体没有参与。',
      ],
      [
        '建立证据链',
        '比较不同来源，将具体证据与论点连接。',
        ['比较独立来源', '说明不确定性与局限'],
        ['比较两条材料的异同', '用一条具体证据支持自己的论点'],
        '怎样构建更可靠的历史论证？',
        [
          '只引用同意自己的材料',
          '把单一来源当作完整记录',
          '删除所有不确定性',
          '比较独立来源并说明局限',
        ],
        3,
        '第三页强调交叉核对和论证中的不确定性。',
      ],
    ],
  },
];
export function createExampleMaterials(): CampusMaterial[] {
  return lessons.map((lesson, i) => {
    const id = `campus-example-material-${i}`;
    const units: StudyUnit[] = lesson.units.map((row, j) => ({
      id: `${id}-unit-${j}`,
      title: row[0] as string,
      overview: row[1] as string,
      pages: [j + 1],
      points: row[2] as string[],
      readingSteps: row[3] as string[],
      questions: [
        {
          id: `${id}-q-${j}`,
          prompt: row[4] as string,
          options: row[5] as string[],
          answer: row[6] as number,
          explanation: row[7] as string,
          sourcePages: [j + 1],
        },
      ],
    }));
    return {
      id,
      courseId: courseSeeds[i].id,
      title: lesson.title,
      week: 5,
      name: `week05-${['interviews', 'evaluation', 'sources'][i]}.txt`,
      status: 'published',
      example: true,
      updatedAt: '2026-10-19T09:00:00Z',
      document: {
        id,
        courseId: courseSeeds[i].id,
        name: lesson.title,
        units,
        mode: 'local',
        createdAt: '2026-10-19T09:00:00Z',
        warnings: [],
        pages: lesson.pages.map(([title, text], j) => ({
          page: j + 1,
          title,
          text,
        })),
      },
    };
  });
}

const databases = new Map<boolean, Promise<IDBDatabase>>();
function database(demo: boolean) {
  if (!databases.has(demo))
    databases.set(
      demo,
      new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(`${prefix(demo)}-materials`, 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore('materials', { keyPath: 'id' });
          request.result.createObjectStore('metadata');
        };
        request.onerror = () =>
          reject(new Error('无法打开课件存储，请检查浏览器存储权限。'));
        request.onblocked = () =>
          reject(new Error('课件存储被旧页面占用，请关闭旧页面后重试。'));
        request.onsuccess = () => {
          request.result.onversionchange = () => {
            request.result.close();
            databases.delete(demo);
          };
          resolve(request.result);
        };
      }).catch((error) => {
        databases.delete(demo);
        throw error;
      }),
    );
  return databases.get(demo)!;
}
export async function readCampusMaterials(
  demo: boolean,
): Promise<CampusMaterial[]> {
  const db = await database(demo);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['materials', 'metadata'], 'readwrite');
    const store = tx.objectStore('materials');
    const marker = tx.objectStore('metadata').get('initialized');
    marker.onsuccess = () => {
      if (!marker.result) {
        if (demo) createExampleMaterials().forEach((m) => store.put(m));
        tx.objectStore('metadata').put(true, 'initialized');
      }
    };
    let result: CampusMaterial[] = [];
    marker.addEventListener('success', () => {
      const req = store.getAll();
      req.onsuccess = () => {
        result = req.result;
      };
    });
    tx.oncomplete = () =>
      resolve(result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    tx.onerror = () => reject(new Error('课件读取失败。'));
    tx.onabort = () => reject(new Error('课件读取已中止。'));
  });
}
export async function writeCampusMaterial(
  demo: boolean,
  material: CampusMaterial,
) {
  const db = await database(demo);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('materials', 'readwrite');
    tx.objectStore('materials').put(material);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('课件未保存，请检查浏览器存储空间。'));
    tx.onabort = () => reject(new Error('课件保存已中止。'));
  });
}

export async function deleteCampusMaterial(demo:boolean,id:string) {
  const db=await database(demo);
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('materials','readwrite');tx.objectStore('materials').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(new Error('课件移除失败。'));});
}
