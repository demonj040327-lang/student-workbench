export type StudyTutorial = {
  id: string;
  title: string;
  keywords: string[];
  explanation: string;
  example?: string;
  checkQuestion?: string;
  sourcePages: number[];
};

export type StudySource = {
  id: string;
  courseId: string;
  name: string;
  type: string;
  url?: string;
  blob?: Blob;
  materialId?: string;
  version?: string;
  tutorials?: StudyTutorial[];
};

export type StudyPage = { page: number; title: string; text: string };
export type StudyQuestion = {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  sourcePages: number[];
};
export type StudyUnit = {
  id: string;
  title: string;
  pages: number[];
  overview: string;
  points: string[];
  readingSteps: string[];
  questions: StudyQuestion[];
};
export type StudyDocument = {
  originalUrl?: string;
  id: string;
  courseId: string;
  name: string;
  pages: StudyPage[];
  units: StudyUnit[];
  mode: 'local' | 'ai';
  createdAt: string;
  warnings: string[];
};
export type StudyAnswer = {
  mode: 'local' | 'ai';
  answer: string;
  sources: { page: number; title: string; excerpt: string }[];
  grounded: boolean;
};
export type StudyProgress = {
  completedUnits: string[];
  answers: Record<string, { option: number; checked: boolean }>;
  activeUnitId?: string;
  updatedAt: string;
};
export type StudyServiceStatus = {
  localParsing: boolean;
  aiConfigured: boolean;
};
