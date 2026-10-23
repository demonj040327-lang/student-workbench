import CourseworkEditor from './CourseworkEditor';

import { fetchDatabaseCourses } from './campusApi';
import CampusLearning from './CampusLearning';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LanguageSwitcher, useI18n } from './i18n';
import {
  isoDate,
  mondayOf,
  shiftDate,
  type Assignment,
  type Step,
} from './data';
import SemesterOverview, { courseworkProgress } from './SemesterOverview';
import { SemesterSettings } from './SemesterControls';
import { studyRequest, errorMessage, uid } from './studyClient';
import {
  createCampusData,
  loadCampusData,
  loadCampusProgress,
  readCampusMaterials,
  saveCampusData,
  saveCampusProgress,
  studentAssignments,
  weekNumber,
  writeCampusMaterial,
  type CampusCourse,
  type CampusData,
  type CampusMaterial,
  type CampusRole,
  type PersonalApi,
  type StudentProgress,
} from './campusStore';

import CampusTeacher from './CampusTeacher';
import Icon from './CampusIcons';
import { Alert, CampusDialog, Empty, Meter } from './CampusUI';

type View = 'overview' | 'courses' | 'week' | 'assignments';
const menu: Record<CampusRole, [View, string, string][]> = {
  student: [
    ['overview', '学期总览', 'home'],
    ['courses', '我的课程', 'book'],
    ['week', '每周任务', 'calendar'],
  ],
  teacher: [
    ['overview', '教学总览', 'home'],
    ['courses', '课程与课件', 'book'],
    ['assignments', '课程作业', 'calendar'],
  ],
};
function initialRole(): CampusRole {
  return new URLSearchParams(location.search).get('role') === 'teacher'
    ? 'teacher'
    : 'student';
}
function initialView(role: CampusRole): View {
  const v = new URLSearchParams(location.search).get('view');
  return menu[role].some(([key]) => key === v) ? (v as View) : 'overview';
}
function dateDays(value: string) {
  return Math.ceil(
    (new Date(`${value}T00:00:00`).getTime() -
      new Date(`${isoDate(new Date())}T00:00:00`).getTime()) /
      86400000,
  );
}

export default function CampusApp({
  onLogout,
}: {
  onLogout?: () => void;
}) {
  const { t, locale } = useI18n();
  const [demo] = useState(
    () => new URLSearchParams(location.search).get('demo') === '1',
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [data, setData] = useState(() => loadCampusData(demo));
  const [databaseCourses, setDatabaseCourses] = useState<CampusCourse[]>([]);
  const [databaseLoading, setDatabaseLoading] = useState(false);
  const [databaseError, setDatabaseError] = useState('');
  const [progress, setProgress] = useState(() => loadCampusProgress(demo));
  const [materials, setMaterials] = useState<CampusMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [role, setRole] = useState(initialRole);
  const [view, setView] = useState(() => initialView(initialRole()));
  const [courseId, setCourseId] = useState(data.courses[0]?.id || '');
  const [materialId, setMaterialId] = useState('');
  const [dialog, setDialog] = useState<
    'api' | 'course' | 'assignment' | 'semester' | null
  >(null);
  const [assignmentId, setAssignmentId] = useState('');
  const [editCoursework, setEditCoursework] = useState<
    Assignment | undefined
  >();
  const [assignmentQuestion, setAssignmentQuestion] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((v) => v + 1), 30000);
    return () => clearInterval(timer);
  }, []);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [api, setApi] = useState<Record<CampusRole, PersonalApi | null>>({
    student: null,
    teacher: null,
  });
  const [status, setStatus] = useState<{
    aiConfigured: boolean;
    model?: string;
  }>({ aiConfigured: false });
  const [notifications, setNotifications] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const assignments = studentAssignments(data, progress);
  const teachingCourses = data.courses.filter(
    (c) => (c.instructorId || 'local-teacher') === 'local-teacher',
  );
  const viewCourses = role === 'teacher' ? teachingCourses : data.courses;
  const teachingAssignments = data.assignments.filter((a) =>
    teachingCourses.some((c) => c.id === a.courseId),
  );
  const currentCourse =
    viewCourses.find((c) => c.id === courseId) || viewCourses[0];
  const visibleMaterials = materials.filter((m) =>
    role === 'teacher'
      ? teachingCourses.some((c) => c.id === m.courseId)
      : m.status === 'published',
  );
  const activeMaterial = visibleMaterials.find(
    (m) => m.id === materialId && m.courseId === currentCourse?.id,
  );
  const selectedAssignment = (role === "teacher" ? teachingAssignments : assignments).find((a) => a.id === assignmentId);
  const dueSoon = assignments
    .filter((a) => a.due && dateDays(a.due) <= 7 && !progress.submitted?.[a.id])
    .sort((a, b) => a.due.localeCompare(b.due));
  const unread = dueSoon.filter(
    (a) =>
      !progress.dismissed.includes(`${a.id}:${a.coursework?.dueAt || a.due}`),
  );
  const materialCounts = (id: string) =>
    visibleMaterials.filter((m) => m.courseId === id);

  // 读取 SQLite 数据库中的课程，仅用于预览
  async function loadDatabasePreview() {
    setDatabaseLoading(true);
    setDatabaseError('');

    try {
      const courses = await fetchDatabaseCourses();
      setDatabaseCourses(courses);
    } catch (error) {
      setDatabaseError(
        error instanceof Error ? error.message : '读取数据库失败'
      );
    } finally {
      setDatabaseLoading(false);
    }
  }



  useEffect(() => {
    try {
      saveCampusData(demo, data);
    } catch {
      setError('课程信息未能保存，请检查浏览器存储空间。');
    }
  }, [data, demo]);
  useEffect(() => {
    try {
      saveCampusProgress(demo, progress);
    } catch {
      setError('学习进度未能保存，请检查浏览器存储空间。');
    }
  }, [progress, demo]);
  useEffect(() => {
    let live = true;
    const reload = () =>
      readCampusMaterials(demo)
        .then((items) => {
          if (live) {
            setMaterials(items);
            setMaterialsLoading(false);
          }
        })
        .catch((e) => {
          if (live) {
            setError(errorMessage(e));
            setMaterialsLoading(false);
          }
        });
    void reload();
    const bc =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(`workbench-campus-${demo ? 'demo' : 'personal'}`)
        : null;
    channel.current = bc;
    if (bc) bc.onmessage = () => void reload();
    function sync(e: StorageEvent) {
      if (
        e.key?.startsWith(`workbench-campus-${demo ? 'demo' : 'personal'}-v1`)
      ) {
        setData(loadCampusData(demo));
        setProgress(loadCampusProgress(demo));
      }
    }
    addEventListener('storage', sync);
    return () => {
      live = false;
      bc?.close();
      channel.current = null;
      removeEventListener('storage', sync);
    };
  }, [demo]);
  useEffect(() => {
    const controller = new AbortController();
    studyRequest<typeof status>('status', undefined, controller.signal)
      .then(setStatus)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    function back() {
      const nextRole = initialRole();
      setRole(nextRole);
      setView(initialView(nextRole));
      setMaterialId('');
      setDialog(null);
    }
    addEventListener('popstate', back);
    return () => removeEventListener('popstate', back);
  }, []);
  useEffect(() => {
    document.title = `${role === 'teacher' ? t('教学空间') : t('学习空间')} · workbench`;
  }, [role, t]);
  function navigate(next: View, nextRole = role) {
    setView(next);
    setRole(nextRole);
    setMaterialId('');
    setNotifications(false);
    setDialog(null);
    setAssignmentId('');
    const url = new URL(location.href);
    url.searchParams.set('role', nextRole);
    url.searchParams.set('view', next);
    history.pushState(null, '', url);
    window.scrollTo({ top: 0 });
  }

  function openCourse(id: string) {
    setCourseId(id);
    navigate('courses');
  }
  function setStep(stepId: string, done: boolean) {
    setProgress((p) => ({ ...p, steps: { ...p.steps, [stepId]: done } }));
  }
  async function saveMaterial(material: CampusMaterial) {
    if (
      role !== 'teacher' ||
      !teachingCourses.some((c) => c.id === material.courseId)
    )
      throw new Error(t('只能管理分配给你的课程资料。'));
    await writeCampusMaterial(demo, material);
    setMaterials((m) => [
      material,
      ...m.filter((item) => item.id !== material.id),
    ]);
    channel.current?.postMessage('updated');
    setNotice(
      material.status === 'published'
        ? '已发布，学生可在课程中查看。'
        : '草稿已保存，学生暂不可见。',
    );
  }
  return (
    <div className="campus-app">
      <a className="skip-link" href="#campus-main">
        {t('跳到主要内容')}
      </a>
      <aside className="cp-sidebar">
        <a
          href={`?${demo ? 'demo=1&' : ''}role=${role}`}
          className="cp-brand"
          onClick={(e) => {
            e.preventDefault();
            navigate('overview');
          }}
        >
          <span className="cp-brand-symbol">
            <i />
            <i />
            <i />
          </span>
          workbench<span className="cp-brand-dot">.</span>
        </a>
        <span className="cp-workspace-label">
          {t(role === 'student' ? '学习空间' : '教学空间')}
        </span>
        <nav className="cp-main-nav" aria-label={t('主导航')}>
          {menu[role].map(([key, label, icon]) => (
            <button
              key={key}
              className={view === key ? 'active' : ''}
              aria-current={view === key ? 'page' : undefined}
              onClick={() => navigate(key)}
            >
              <Icon name={icon} size={19} />
              <span>{t(label)}</span>
              {key === 'courses' && <small>{viewCourses.length}</small>}
            </button>
          ))}
        </nav>
        <div className="cp-sidebar-courses">
          <div>
            <span>{t(role === 'student' ? '我的课程' : '教学课程')}</span>
            {role === 'teacher' && (
              <button
                onClick={() => setDialog('course')}
                className="cp-icon-button"
                aria-label={t('创建课程')}
              >
                <Icon name="plus" size={16} />
              </button>
            )}
          </div>
          {viewCourses.map((course) => (
            <button
              key={course.id}
              onClick={() => openCourse(course.id)}
              className={
                view === 'courses' && currentCourse?.id === course.id
                  ? 'active'
                  : ''
              }
            >
              <i style={{ background: course.color }} />
              <span>{t(course.name)}</span>
              <small>{course.code}</small>
            </button>
          ))}
        </div>
        <div className="cp-sidebar-bottom">
          <div className="cp-mini-note">
            <Icon name={role === 'student' ? 'book' : 'layers'} size={22} />
            <strong>
              {t(
                role === 'student'
                  ? '每周，向前一步。'
                  : '从课件，到学习体验。',
              )}
            </strong>
            <p>
              {t(
                role === 'student'
                  ? '课程、进度和问题，都在这里。'
                  : '准备资料，把时间留给教学。',
              )}
            </p>
          </div>
          <button className="cp-api-shortcut" onClick={() => setDialog('api')}>
            <Icon name="key" size={17} />
            <div>
              <strong>
                {t(role === 'student' ? '我的 ELM API' : '教学 ELM API')}
              </strong>
              <small>
                {t(
                  api[role]
                    ? '已设置 · 仅本次打开'
                    : role === 'teacher' && status.aiConfigured
                      ? '本机接口已配置'
                      : '尚未设置',
                )}
              </small>
            </div>
            <Icon name="chevron" size={15} />
          </button>


          <div className="cp-profile">
            <span>{role === 'student' ? 'S' : 'T'}</span>

            <div>
              <strong>
                {t(role === 'student' ? '学生视角' : '教师视角')}
              </strong>

              <small>{t('TeachAthon 演示账号')}</small>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  style={{
                    marginTop: 10,
                    padding: '6px 10px',
                    border: '1px solid #ddd',
                    borderRadius: 6,
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  退出登录 ↗
                </button>
              )}
            </div>
          </div>








        </div>
      </aside>
      <div className="cp-workspace">
        <header className="cp-topbar">
          <div className="cp-breadcrumb">
            <span>workbench</span>
            <Icon name="chevron" size={12} />
            <strong>
              {t(menu[role].find(([key]) => key === view)?.[1] || '')}
            </strong>
          </div>
          <div className="cp-topbar-tools">
            <div className="cp-role-switch" aria-label={t('当前使用身份')}>
              <span style={{ padding: '8px 16px', fontWeight: 600 }}>
                {t(role === 'student' ? '学生' : '教师')}
              </span>
            </div>

            <LanguageSwitcher />
            <button
              className="cp-icon-button cp-top-api"
              onClick={() => setDialog('api')}
              aria-label={t('个人 API 设置')}
              title={t('个人 API 设置')}
            >
              <Icon name="key" size={18} />
            </button>
            {role === 'student' && (
              <button
                className="cp-icon-button cp-bell"
                onClick={() => setNotifications(!notifications)}
                aria-label={t('每周提醒')}
                aria-expanded={notifications}
              >
                <Icon name="bell" />
                {unread.length > 0 && <i />}
              </button>
            )}






            <div className="cp-account-wrapper">
              <button
                type="button"
                className="cp-top-avatar cp-avatar-button"
                onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                aria-label="打开账号菜单"
                aria-expanded={accountMenuOpen}
                aria-haspopup="menu"
              >
                {role === 'student' ? 'S' : 'T'}
              </button>

              {accountMenuOpen && (
                <div className="cp-account-menu">
                  <div className="cp-account-info">
                    <strong>
                      {role === 'student' ? '演示学生' : '演示教师'}
                    </strong>
                    <small>
                      当前身份：{role === 'student' ? '学生' : '教师'}
                    </small>
                  </div>

                  <div className="cp-account-divider" />

                  <button
                    type="button"
                    className="cp-account-logout"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onLogout?.();
                    }}
                  >
                    退出登录
                  </button>
                </div>
              )}
            </div>








          </div>
        </header>
        {notifications && (
          <div className="cp-notification-popover">
            <header>
              <h3>{t('每周提醒')}</h3>
              <button
                className="cp-link"
                onClick={() =>
                  setProgress((p) => ({
                    ...p,
                    dismissed: [
                      ...new Set([
                        ...p.dismissed,
                        ...dueSoon.map(
                          (a) => `${a.id}:${a.coursework?.dueAt || a.due}`,
                        ),
                      ]),
                    ],
                  }))
                }
              >
                {t('全部标为已读')}
              </button>
            </header>
            {!dueSoon.length && <p>{t('未来一周没有待提交作业。')}</p>}
            {dueSoon.map((a) => (
              <button
                key={a.id}
                onClick={() => {
                  setAssignmentId(a.id);
                  setNotifications(false);
                }}
              >
                <i
                  className={
                    progress.dismissed.includes(
                      `${a.id}:${a.coursework?.dueAt || a.due}`,
                    )
                      ? 'read'
                      : ''
                  }
                />
                <div>
                  <strong>{t(a.title)}</strong>
                  <small>
                    {a.due} ·{' '}
                    {t(
                      dateDays(a.due) < 0 ? '已超过截止日期' : '还有 {days} 天',
                      { days: dateDays(a.due) },
                    )}
                  </small>
                </div>
                <Icon name="chevron" size={15} />
              </button>
            ))}
            <small>{t('站内提醒；页面关闭时不会推送通知。')}</small>
          </div>
        )}
        <main id="campus-main" tabIndex={-1} className="cp-main">
          {demo && (
            <div className="cp-demo-strip">
              <span>
                <i />
                {t('交互演示')}
                <span className="cp-demo-description">
                  {t('课程与资料均为示例，可切换视角体验发布与学习。')}
                </span>
              </span>
              <a href="/?role=teacher">
                {t('进入正式空白空间')}
                <Icon name="arrow" size={13} />
              </a>
            </div>
          )}
          {error && <Alert>{t(error)}</Alert>}
          {role === 'student' && view === 'overview' && (
            <>
              <div className="cp-student-overview simplified-app">
                <SemesterOverview
                  courses={viewCourses.map((c) => ({ ...c, name: t(c.name) }))}
                  assignments={assignments.map((a) => ({
                    ...a,
                    title: t(a.title),
                  }))}
                  semester={data.semester}
                  anchor={mondayOf(new Date())}
                  onOpen={(a) => setAssignmentId(a.id)}
                  onAdd={() => navigate('courses')}
                  addLabel="查看课程资料"
                  onSettings={() => setDialog('semester')}
                />
              </div>
              <div className="cp-overview-bottom">
                <WeeklyTasks
                  courses={viewCourses}
                  assignments={assignments}
                  onStep={setStep}
                  onCourse={openCourse}
                  compact
                />
                <aside className="cp-card cp-reminder-card">
                  <div className="cp-section-heading">
                    <h2>{t('本周提醒')}</h2>
                    <Icon name="bell" size={19} />
                  </div>
                  <p>{t('优先留意即将到来的提交。')}</p>
                  {dueSoon.length ? (
                    dueSoon.slice(0, 3).map((a) => (
                      <button
                        className="cp-reminder-item"
                        key={a.id}
                        onClick={() => setAssignmentId(a.id)}
                      >
                        <span className="cp-deadline-number">
                          {Math.abs(dateDays(a.due))}
                          <small>
                            {t(dateDays(a.due) < 0 ? '天已逾期' : '天后截止')}
                          </small>
                        </span>
                        <div>
                          <span className="cp-eyebrow">
                            {
                              data.courses.find((c) => c.id === a.courseId)
                                ?.code
                            }
                          </span>
                          <strong>{t(a.title)}</strong>
                          <small>{a.due}</small>
                        </div>
                        <Icon name="chevron" size={16} />
                      </button>
                    ))
                  ) : (
                    <div className="cp-reminder-clear">
                      <Icon name="check" size={25} />
                      <strong>{t('本周暂无紧迫提交')}</strong>
                    </div>
                  )}
                  <button className="cp-link" onClick={() => navigate('week')}>
                    {t('查看完整周计划')}
                    <Icon name="arrow" size={15} />
                  </button>
                  <small className="cp-reminder-note">
                    {t('提醒依据教师设置的截止日期。')}
                  </small>
                </aside>
              </div>
              <CourseCards
                courses={viewCourses}
                materials={visibleMaterials}
                onOpen={openCourse}
                role={role}
              />
            </>
          )}
          {role === 'teacher' && view === 'overview' && (
            <>
              <header className="cp-page-heading">
                <div>
                  <span className="cp-eyebrow">
                    TEACHING WORKSPACE · 2026/27
                  </span>
                  <h1>{t('教学总览')}</h1>
                  <p>{t('管理课程资料，准备下一次有依据的学习。')}</p>
                </div>

                <button
                  className="cp-button primary"
                  onClick={() => setDialog('course')}
                >
                  <Icon name="plus" size={17} />
                  {t('创建课程')}
                </button>

                {role === 'teacher' && (
                  <button
                    type="button"
                    className="cp-button"
                    onClick={() => void loadDatabasePreview()}
                    disabled={databaseLoading}
                  >
                    {databaseLoading ? '读取中...' : '查看 SQLite 课程'}
                  </button>
                )}
              </header>


              {role === 'teacher' && (
                <section className="cp-db-preview">
                  <h3>SQLite 数据库课程预览</h3>
                  <p>仅用于测试数据库连接，不会修改现有课程。</p>

                  {databaseError && (
                    <p role="alert">{databaseError}</p>
                  )}

                  {databaseCourses.map((course) => (
                    <div key={course.id}>
                      <strong>{course.name}</strong>
                      {' · '}
                      {course.code}
                      {' · '}
                      {course.teacher || '未设置教师'}
                    </div>
                  ))}

                  {!databaseLoading &&
                    databaseCourses.length === 0 &&
                    !databaseError && (
                      <p>点击上方按钮读取 SQLite 课程。</p>
                    )}
                </section>
              )}

              <div className="cp-teacher-stats">

                {[
                  [viewCourses.length, '门教学课程', 'book'],
                  [
                    visibleMaterials.filter((m) => m.status === 'published')
                      .length,
                    '份已发布课件',
                    'file',
                  ],
                  [
                    visibleMaterials.filter((m) => m.status === 'draft').length,
                    '份待检查草稿',
                    'layers',
                  ],
                  [
                    visibleMaterials
                      .filter((m) => m.status === 'published')
                      .flatMap((m) =>
                        m.document.units.flatMap((u) => u.questions),
                      ).length,
                    '道已发布练习',
                    'check',
                  ],
                ].map(([n, label, icon]) => (
                  <div className="cp-card" key={String(label)}>
                    <span>
                      <Icon name={String(icon)} size={20} />
                    </span>
                    <strong>{String(n).padStart(2, '0')}</strong>
                    <small>{t(String(label))}</small>
                  </div>
                ))}
              </div>
              <div className="cp-teacher-intro cp-card">
                <div>
                  <span className="cp-eyebrow">PREPARE. REVIEW. PUBLISH.</span>
                  <h2>{t('一次发布，全班都能开始。')}</h2>
                  <p>
                    {t(
                      '上传课件，让模型起草分步指导与练习。由你检查内容，决定何时发布。',
                    )}
                  </p>
                  <button
                    className="cp-button primary"
                    onClick={() =>
                      viewCourses.length
                        ? navigate('courses')
                        : setDialog('course')
                    }
                  >
                    {t('准备课程内容')}
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
                <div className="cp-teaching-illustration" aria-hidden="true">
                  <div>
                    <Icon name="file" size={23} />
                    <span>LECTURE</span>
                    <i />
                    <i />
                  </div>
                  <Icon name="arrow" size={22} />
                  <div>
                    <Icon name="layers" size={23} />
                    <span>MODULES</span>
                    <i />
                    <i />
                  </div>
                  <Icon name="arrow" size={22} />
                  <div>
                    <Icon name="check" size={23} />
                    <span>PUBLISH</span>
                    <i />
                    <i />
                  </div>
                </div>
              </div>
              <CourseCards
                courses={viewCourses}
                materials={materials}
                onOpen={openCourse}
                role={role}
              />
              <section className="cp-recent-section">
                <div className="cp-section-heading">
                  <h2>{t('最近更新')}</h2>
                  <span className="cp-muted">{t('课件发布与草稿')}</span>
                </div>
                <div className="cp-card cp-recent-list">
                  {visibleMaterials.slice(0, 5).map((m) => (
                    <button key={m.id} onClick={() => openCourse(m.courseId)}>
                      <span className="cp-file-icon">
                        <Icon name="file" size={19} />
                      </span>
                      <div>
                        <strong>{t(m.title)}</strong>
                        <small>
                          {data.courses.find((c) => c.id === m.courseId)?.code}{' '}
                          · {t('第 {week} 周', { week: m.week })}
                        </small>
                      </div>
                      <span
                        className={`cp-status ${m.status === 'published' ? 'connected' : 'draft'}`}
                      >
                        {t(m.status === 'published' ? '已发布' : '草稿')}
                      </span>
                      <Icon name="chevron" size={16} />
                    </button>
                  ))}
                  {!visibleMaterials.length && (
                    <Empty title={t('还没有课程资料')} />
                  )}
                </div>
              </section>
            </>
          )}
          {view === 'courses' && (
            <>
              {activeMaterial && role === 'student' ? (
                <CampusLearning
                  key={activeMaterial.id}
                  material={activeMaterial}
                  progress={progress}
                  onProgress={setProgress}
                  api={api.student}
                  onConnect={() => setDialog('api')}
                  onBack={() => setMaterialId('')}
                />
              ) : (
                <>
                  <header className="cp-page-heading cp-course-page-heading">
                    <div>
                      <span className="cp-eyebrow">
                        {role === 'teacher'
                          ? 'COURSE MANAGEMENT'
                          : 'MY COURSES'}
                      </span>
                      <h1>
                        {t(role === 'teacher' ? '课程与课件' : '我的课程')}
                      </h1>
                      <p>
                        {t(
                          role === 'teacher'
                            ? '按课程管理资料，生成并发布学习内容。'
                            : '教师已整理好课程资料，从这里开始本周学习。',
                        )}
                      </p>
                    </div>
                    {role === 'teacher' && (
                      <button
                        className="cp-button"
                        onClick={() => setDialog('course')}
                      >
                        <Icon name="plus" size={16} />
                        {t('创建课程')}
                      </button>
                    )}
                  </header>
                  <div className="cp-course-tabs" aria-label={t('选择课程')}>
                    {viewCourses.map((c) => (
                      <button
                        key={c.id}
                        className={currentCourse?.id === c.id ? 'active' : ''}
                        aria-pressed={currentCourse?.id === c.id}
                        onClick={() => {
                          setCourseId(c.id);
                          setMaterialId('');
                        }}
                      >
                        <i style={{ background: c.color }} />
                        {c.code}
                        <span>{t(c.name)}</span>
                      </button>
                    ))}
                  </div>
                  {currentCourse ? (
                    role === 'teacher' ? (
                      <CampusTeacher
                        onCoursework={() => {
                          setEditCoursework(undefined);
                          setDialog('assignment');
                        }}
                        key={currentCourse.id}
                        course={currentCourse}
                        materials={materialCounts(currentCourse.id)}
                        onSave={saveMaterial}
                        api={api.teacher}
                        hostConfigured={status.aiConfigured}
                        onConnect={() => setDialog('api')}
                      />
                    ) : (
                      <>
                        <div
                          className="cp-course-cover"
                          style={
                            {
                              '--course-color': currentCourse.color,
                            } as React.CSSProperties
                          }
                        >
                          <span className="cp-course-monogram">
                            {currentCourse.code}
                          </span>
                          <div>
                            <span className="cp-eyebrow">
                              {t('本学期课程')}
                            </span>
                            <h2>{t(currentCourse.name)}</h2>
                            <p>
                              {currentCourse.teacher} ·{' '}
                              {t(currentCourse.description)}
                            </p>
                          </div>
                          <span className="cp-status connected">
                            {t('已加入课程')}
                          </span>
                        </div>
                        <div className="cp-section-heading">
                          <div>
                            <h2>{t('课件与学习内容')}</h2>
                            <p>
                              {t('选择一份课件，阅读指导、完成练习或提问。')}
                            </p>
                          </div>
                          <span className="cp-muted">
                            {t('{count} 份已发布资料', {
                              count: materialCounts(currentCourse.id).length,
                            })}
                          </span>
                        </div>
                        {materialsLoading ? (
                          <p role="status">{t('正在读取课程资料…')}</p>
                        ) : (
                          <div className="cp-student-materials">
                            {materialCounts(currentCourse.id).map((m) => {
                              const units = m.document.units;
                              const done = units.filter(
                                (u) => progress.units[u.id],
                              ).length;
                              return (
                                <button
                                  className="cp-card cp-student-material"
                                  key={m.id}
                                  onClick={() => {
                                    setMaterialId(m.id);
                                    window.scrollTo({ top: 0 });
                                  }}
                                >
                                  <span className="cp-material-week">
                                    {t('第 {week} 周', { week: m.week })}
                                    <Icon name="file" size={25} />
                                  </span>
                                  <div>
                                    <span className="cp-eyebrow">
                                      {m.name.split('.').pop()?.toUpperCase()} ·{' '}
                                      {t('{count} 页资料', {
                                        count: m.document.pages.length,
                                      })}
                                    </span>
                                    <h3>{t(m.title)}</h3>
                                    <p>
                                      {t(
                                        '{units} 个学习模块 · {questions} 道课后练习',
                                        {
                                          units: units.length,
                                          questions: units.flatMap(
                                            (u) => u.questions,
                                          ).length,
                                        },
                                      )}
                                    </p>
                                    <div className="cp-material-completion">
                                      <Meter
                                        percent={
                                          units.length
                                            ? Math.round(
                                                (done / units.length) * 100,
                                              )
                                            : 0
                                        }
                                        color={currentCourse.color}
                                        label={t('学习模块完成度')}
                                      />
                                      <small>
                                        {done}/{units.length}
                                      </small>
                                    </div>
                                  </div>
                                  <span className="cp-material-enter">
                                    {t(done ? '继续学习' : '开始学习')}
                                    <Icon name="arrow" size={17} />
                                  </span>
                                </button>
                              );
                            })}
                            {!materialCounts(currentCourse.id).length && (
                              <Empty title={t('教师还没有发布这门课的资料')}>
                                <p>
                                  {t('发布后会出现在这里，学生无需重复上传。')}
                                </p>
                              </Empty>
                            )}
                          </div>
                        )}
                      </>
                    )
                  ) : (
                    <Empty title={t('还没有课程')}>
                      <p>
                        {t(
                          role === 'teacher'
                            ? '先创建课程，再上传教学资料。'
                            : '教师创建并发布课程后，你就能在这里学习。',
                        )}
                      </p>
                      {role === 'teacher' && (
                        <button
                          className="cp-button primary"
                          onClick={() => setDialog('course')}
                        >
                          {t('创建课程')}
                        </button>
                      )}
                    </Empty>
                  )}
                </>
              )}
            </>
          )}
          {role === 'student' && view === 'week' && (
            <>
              <header className="cp-page-heading">
                <div>
                  <span className="cp-eyebrow">WEEKLY PLAN</span>
                  <h1>{t('每周任务')}</h1>
                  <p>{t('按课程查看这一周的作业步骤，完成一点，记录一点。')}</p>
                </div>
                <span className="cp-tag">
                  {t('当前第 {week} 周', { week: weekNumber(data.semester) })}
                </span>
              </header>
              <WeeklyTasks
                courses={viewCourses}
                assignments={assignments}
                onStep={setStep}
                onCourse={openCourse}
              />
            </>
          )}
          {role === 'teacher' && view === 'assignments' && (
            <>
              <header className="cp-page-heading">
                <div>
                  <span className="cp-eyebrow">COURSEWORK</span>
                  <h1>{t('课程作业')}</h1>
                  <p>{t('发布作业要求与截止日期，学生独立记录完成进度。')}</p>
                </div>
                <button
                  className="cp-button primary"
                  onClick={() => {
                    setEditCoursework(undefined);
                    setDialog('assignment');
                  }}
                  disabled={!viewCourses.length}
                >
                  <Icon name="plus" size={17} />
                  {t('发布作业')}
                </button>
              </header>
              <div className="cp-card cp-assignment-list">
                {teachingAssignments.map((a) => (
                  <article key={a.id}>
                    <span
                      className="cp-course-chip"
                      style={{
                        color: data.courses.find((c) => c.id === a.courseId)
                          ?.color,
                      }}
                    >
                      {data.courses.find((c) => c.id === a.courseId)?.code}
                    </span>
                    <div>
                      <h3>{t(a.title)}</h3>
                      <p>
                        {a.startsOn} → {a.due || t('截止时间待确认')} ·{' '}
                        {t('{count} 个步骤', { count: a.steps.length })}
                      </p>
                    </div>
                    <button
                      className="cp-button"
                      onClick={() => setAssignmentId(a.id)}
                    >
                      {t('查看要求')}
                      <Icon name="chevron" size={15} />
                    </button>
                    <button
                      className="cp-button"
                      onClick={() => {
                        setEditCoursework(a);
                        setDialog('assignment');
                      }}
                    >
                      {t('检查与编辑')}
                    </button>
                    <span className="cp-status">
                      {a.coursework?.status === 'draft'
                        ? t('草稿')
                        : a.coursework &&
                            Date.parse(a.coursework.releaseAt) > Date.now()
                          ? 'Scheduled / 定时发布'
                          : t('已发布')}
                    </span>
                  </article>
                ))}
                {!teachingAssignments.length && (
                  <Empty title={t('还没有课程作业')} />
                )}
              </div>
            </>
          )}
          <footer className="cp-footer">
            <span>workbench · TeachAthon 2026</span>
            <span>
              {t('本地原型：视角切换用于演示，尚未接入学校账号与跨设备同步。')}
            </span>
          </footer>
        </main>
      </div>
      <nav className="cp-bottom-nav" aria-label={t('手机导航')}>
        {menu[role].map(([key, label, icon]) => (
          <button
            key={key}
            className={view === key ? 'active' : ''}
            aria-current={view === key ? 'page' : undefined}
            onClick={() => navigate(key)}
          >
            <Icon name={icon} size={20} />
            <span>{t(label)}</span>
          </button>
        ))}
      </nav>
      {notice && (
        <div className="cp-toast" role="status">
          <Icon name="check" size={17} />
          {t(notice)}
        </div>
      )}
      {dialog === 'api' && (
        <CampusDialog
          title={t(role === 'student' ? '连接我的 ELM API' : '教学 ELM API')}
          onClose={() => setDialog(null)}
        >
          <ApiSettings
            role={role}
            value={api[role]}
            model={status.model}
            hostConfigured={status.aiConfigured}
            onSave={(value) => {
              setApi((a) => ({ ...a, [role]: value }));
              setDialog(null);
              setNotice(
                value ? 'API 已设置，仅用于本次打开。' : '个人 API 已断开。',
              );
            }}
          />
        </CampusDialog>
      )}
      {dialog === 'course' && (
        <CampusDialog title={t('创建课程')} onClose={() => setDialog(null)}>
          <NewCourse
            onSave={(course) => {
              setData((d) => ({ ...d, courses: [...d.courses, course] }));
              setCourseId(course.id);
              navigate('courses');
              setNotice('课程已创建，可以上传课件。');
            }}
          />
        </CampusDialog>
      )}
      {dialog === 'assignment' && (
        <CampusDialog title={t('发布作业')} onClose={() => setDialog(null)}>
          <CourseworkEditor
            courses={viewCourses}
            initial={editCoursework}
            api={api.teacher}
            hostConfigured={status.aiConfigured}
            onConnect={() => setDialog('api')}
            onSave={(assignment) => {
              setData((d) => ({
                ...d,
                assignments: [
                  ...d.assignments.filter((a) => a.id !== assignment.id),
                  assignment,
                ],
              }));
              setDialog(null);
              setNotice(
                assignment.coursework?.status === 'draft'
                  ? '草稿已保存，学生暂不可见。'
                  : '作业已发布，已加入学生的时间轴与提醒。',
              );
            }}
          />
        </CampusDialog>
      )}
      {dialog === 'semester' && (
        <CampusDialog title={t('学期设置')} onClose={() => setDialog(null)}>
          <SemesterSettings
            semester={data.semester}
            onSave={(semester) => {
              setData((d) => ({ ...d, semester }));
              setDialog(null);
            }}
          />
        </CampusDialog>
      )}
      {selectedAssignment && (
        <CampusDialog
          title={t(role === 'student' ? '作业进度' : '作业要求')}
          onClose={() => {
            setAssignmentId('');
            setAssignmentQuestion(false);
          }}
        >
          <div className="cp-assignment-detail">
            <span className="cp-eyebrow">
              {
                data.courses.find((c) => c.id === selectedAssignment.courseId)
                  ?.code
              }
            </span>
            <h3>{t(selectedAssignment.title)}</h3>
            <p className="cp-muted">
              {selectedAssignment.coursework?.dueAt}{' '}
              {selectedAssignment.coursework ? 'UTC' : ''}
            </p>
            {selectedAssignment.coursework && (
              <>
                <p>{selectedAssignment.coursework.submissionType}</p>
                <p>{selectedAssignment.coursework.deliverables}</p>
                <p>{selectedAssignment.coursework.rubric}</p>
                {selectedAssignment.coursework.revisions.map((r, i) => (
                  <p key={i} className="cp-info">
                    Deadline updated / 截止时间更新：{r.before} → {r.after}
                  </p>
                ))}
              </>
            )}
            {role === 'student' && (
              <>
                <label className="cp-check-label">
                  <input
                    type="checkbox"
                    checked={!!progress.submitted?.[selectedAssignment.id]}
                    onChange={(e) =>
                      setProgress((p) => ({
                        ...p,
                        submitted: {
                          ...p.submitted,
                          [selectedAssignment.id]: e.target.checked
                            ? new Date().toISOString()
                            : '',
                        },
                      }))
                    }
                  />
                  我已在学校系统提交 / Submitted in the university system
                </label>
                <p className="cp-fineprint">
                  此为手动记录，不会向学校提交文件。步骤完成与实际提交分别记录。
                </p>
                {selectedAssignment.coursework?.dueAt &&
                  Date.parse(selectedAssignment.coursework.dueAt) <
                    Date.now() && <p className="cp-info">已截止 / Closed</p>}
                {selectedAssignment.coursework?.document && (
                  <button
                    className="cp-button"
                    onClick={() => setAssignmentQuestion(!assignmentQuestion)}
                  >
                    作业说明问答 / Brief Q&amp;A
                  </button>
                )}
              </>
            )}
            {assignmentQuestion && selectedAssignment.coursework?.document && (
              <CampusLearning
                key={selectedAssignment.id}
                material={{
                  id: selectedAssignment.id,
                  courseId: selectedAssignment.courseId,
                  title: selectedAssignment.title,
                  week: 1,
                  name: selectedAssignment.coursework.document.name,
                  status: 'published',
                  document: {
                    ...selectedAssignment.coursework.document,
                    units: [],
                  },
                  updatedAt: new Date().toISOString(),
                }}
                progress={progress}
                onProgress={setProgress}
                api={api.student}
                onConnect={() => {
                  setAssignmentId('');
                  setDialog('api');
                }}
                onBack={() => setAssignmentQuestion(false)}
              />
            )}
            <p>
              {t('截止日期')} · {selectedAssignment.due}
            </p>
            <p className="cp-muted">{t(selectedAssignment.brief)}</p>
            {role === 'student' && (
              <div className="cp-assignment-completion">
                <Meter
                  percent={courseworkProgress(selectedAssignment)}
                  label={t('作业完成度')}
                />
                <strong>{courseworkProgress(selectedAssignment)}%</strong>
              </div>
            )}
            <ul>
              {selectedAssignment.steps.map((s, i) => (
                <li key={s.id}>
                  {role === 'student' ? (
                    <label className={s.done ? 'done' : ''}>
                      <input
                        type="checkbox"
                        checked={s.done}
                        onChange={(e) => setStep(s.id, e.target.checked)}
                      />
                      <span>
                        <strong>{t(s.title)}</strong>
                        <small>
                          {t('建议 {minutes} 分钟', { minutes: s.minutes })}
                        </small>
                      </span>
                    </label>
                  ) : (
                    <div>
                      <span className="cp-step-number">{i + 1}</span>
                      <strong>{t(s.title)}</strong>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <small className="cp-muted">
              {t(
                role === 'student'
                  ? '完成度由你勾选的步骤计算，进度只记录在你的学习空间。'
                  : '教师端展示作业要求；学生的个人完成记录分别保存。',
              )}
            </small>
          </div>
        </CampusDialog>
      )}
    </div>
  );
}

function CourseCards({
  courses,
  materials,
  onOpen,
  role,
}: {
  courses: CampusCourse[];
  materials: CampusMaterial[];
  onOpen: (id: string) => void;
  role: CampusRole;
}) {
  const { t } = useI18n();
  return (
    <section className="cp-course-section">
      <div className="cp-section-heading">
        <div>
          <span className="cp-eyebrow">
            {role === 'teacher' ? 'YOUR TEACHING' : 'YOUR COURSES'}
          </span>
          <h2>{t(role === 'teacher' ? '教学课程' : '我的课程')}</h2>
        </div>
        <span className="cp-muted">
          {t('{count} 门课程', { count: courses.length })}
        </span>
      </div>
      <div className="cp-course-grid">
        {courses.map((c, i) => (
          <button
            className="cp-card cp-course-card"
            style={{ '--course-color': c.color } as React.CSSProperties}
            key={c.id}
            onClick={() => onOpen(c.id)}
          >
            <div className={`cp-course-art art-${i % 4}`}>
              <span>{c.code}</span>
              <div className="cp-course-art-shape">
                <i />
                <i />
                <i />
                <i />
              </div>
              <Icon name="arrow" size={18} />
            </div>
            <div className="cp-course-card-copy">
              <h3>{t(c.name)}</h3>
              <p>{c.teacher}</p>
              <footer>
                <span>
                  <Icon name="file" size={14} />
                  {t('{count} 份资料', {
                    count: materials.filter((m) => m.courseId === c.id).length,
                  })}
                </span>
                <span>
                  {t(role === 'teacher' ? '管理课程' : '进入课程')} ↗
                </span>
              </footer>
            </div>
          </button>
        ))}
      </div>
      {!courses.length && <Empty title={t('还没有课程')} />}
    </section>
  );
}

function WeeklyTasks({
  courses,
  assignments,
  onStep,
  onCourse,
  compact = false,
}: {
  courses: CampusCourse[];
  assignments: Assignment[];
  onStep: (id: string, done: boolean) => void;
  onCourse: (id: string) => void;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const [offset, setOffset] = useState(0);
  const start = shiftDate(mondayOf(new Date()), offset * 7),
    end = shiftDate(start, 6);
  const date = (v: string) =>
    new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(
      new Date(v + 'T12:00:00'),
    );
  function scheduled(a: Assignment, s: Step, index: number) {
    const from = new Date((a.startsOn || start) + 'T12:00:00').getTime(),
      to = new Date((a.due || end) + 'T12:00:00').getTime();
    return isoDate(
      new Date(
        from +
          (Math.max(0, to - from) * index) / Math.max(1, a.steps.length - 1),
      ),
    );
  }
  const groups = courses
    .map((course) => ({
      course,
      tasks: assignments
        .filter((a) => a.courseId === course.id)
        .flatMap((a) =>
          a.steps.map((step, i) => ({
            assignment: a,
            step,
            date: scheduled(a, step, i),
          })),
        )
        .filter((item) => item.date >= start && item.date <= end),
    }))
    .filter((g) => g.tasks.length);
  return (
    <section className={`cp-card cp-weekly ${compact ? 'compact' : ''}`}>
      <div className="cp-section-heading">
        <div>
          <span className="cp-eyebrow">THIS WEEK</span>
          <h2>{t('本周学习安排')}</h2>
        </div>
        <div className="cp-week-control">
          <button
            aria-label={t('上一周')}
            onClick={() => setOffset((o) => o - 1)}
          >
            ←
          </button>
          <span>
            {date(start)} — {date(end)}
          </span>
          <button
            aria-label={t('下一周')}
            onClick={() => setOffset((o) => o + 1)}
          >
            →
          </button>
        </div>
      </div>
      {offset !== 0 && (
        <button className="cp-link" onClick={() => setOffset(0)}>
          {t('回到本周')}
        </button>
      )}
      {groups.map(({ course, tasks }) => (
        <div className="cp-week-course" key={course.id}>
          <header>
            <button onClick={() => onCourse(course.id)}>
              <i style={{ background: course.color }} />
              {t(course.name)}
              <Icon name="chevron" size={14} />
            </button>
            <span>
              {tasks.filter((item) => item.step.done).length}/{tasks.length}
            </span>
          </header>
          {tasks
            .slice(0, compact ? 3 : 100)
            .map(({ assignment, step, date: day }) => (
              <label
                className={`cp-week-task ${step.done ? 'done' : ''}`}
                key={step.id}
              >
                <input
                  type="checkbox"
                  checked={step.done}
                  onChange={(e) => onStep(step.id, e.target.checked)}
                />
                <span>
                  <strong>{t(step.title)}</strong>
                  <small>
                    {t(assignment.title)} ·{' '}
                    {t('建议 {minutes} 分钟', { minutes: step.minutes })}
                  </small>
                </span>
                <time dateTime={day}>{date(day)}</time>
              </label>
            ))}
        </div>
      ))}
      {!groups.length && (
        <div className="cp-week-empty">
          <Icon name="calendar" size={26} />
          <strong>{t('这一周没有安排作业步骤')}</strong>
          <p>{t('可以浏览课程资料，或切换周次查看后续安排。')}</p>
        </div>
      )}
      <p className="cp-fineprint">
        {t('步骤按作业起止日期均匀安排；可随时勾选，保留自己的节奏。')}
      </p>
    </section>
  );
}

function ApiSettings({
  role,
  value,
  model,
  hostConfigured,
  onSave,
}: {
  role: CampusRole;
  value: PersonalApi | null;
  model?: string;
  hostConfigured: boolean;
  onSave: (api: PersonalApi | null) => void;
}) {
  const { t } = useI18n();
  const [key, setKey] = useState(value?.key || '');
  const [modelName, setModel] = useState(value?.model || model || '');
  return (
    <form
      className="cp-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ key: key.trim(), model: modelName.trim() });
      }}
    >
      <div className="cp-api-explainer">
        <Icon name="key" size={26} />
        <p>
          {t(
            role === 'student'
              ? '课件由教师提供。AI 问答使用你自己的 ELM 额度。'
              : '用于从课件生成学习指导与课后练习。',
          )}
        </p>
      </div>
      <label>
        {t('ELM API Key')}
        <input
          type="password"
          autoComplete="off"
          name="personal-elm-key"
          required
          maxLength={4096}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={t('粘贴你的个人 API Key')}
        />
      </label>
      <label>
        {t('模型名称')}
        <input
          required
          maxLength={160}
          value={modelName}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Qwen/Qwen3.5-397B-A17B-FP8"
        />
      </label>
      <p className="cp-fineprint">
        {t(
          '密钥仅保留在当前页面内存中，刷新后清除。请求由本机后端转发至学校 ELM；不会写入浏览器存储或课件数据。',
        )}
      </p>
      <p className="cp-fineprint">
        {t('保存配置不代表密钥已通过验证；实际调用失败会显示原因。')}
      </p>
      <a
        href="https://elm.edina.ac.uk/"
        target="_blank"
        rel="noreferrer"
        className="cp-link"
      >
        {t('打开 ELM 获取个人 API Key')} ↗
      </a>
      <div className="cp-form-actions">
        <button className="cp-button primary">{t('用于本次打开')}</button>
        {value && (
          <button
            className="cp-button"
            type="button"
            onClick={() => onSave(null)}
          >
            {t('断开个人 API')}
          </button>
        )}
        {role === 'teacher' && hostConfigured && (
          <button
            className="cp-button"
            type="button"
            onClick={() => onSave(null)}
          >
            {t('使用本机教学接口')}
          </button>
        )}
      </div>
    </form>
  );
}
function NewCourse({ onSave }: { onSave: (course: CampusCourse) => void }) {
  const { t } = useI18n();
  const [error, setError] = useState('');
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    if (
      ['name', 'code', 'teacher'].some((field) => !String(d.get(field)).trim())
    ) {
      setError('请完整填写课程名称、简称与授课教师。');
      return;
    }
    onSave({
      id: uid(),
      name: String(d.get('name')).trim(),
      code: String(d.get('code')).trim(),
      teacher: String(d.get('teacher')).trim(),
      instructorId: 'local-teacher',
      description: String(d.get('description')).trim(),
      subject: '',
      color: String(d.get('color')),
    });
  }
  return (
    <form className="cp-form" onSubmit={submit}>
      <label>
        {t('课程名称')}
        <input name="name" required maxLength={80} />
      </label>
      <div className="cp-form-row">
        <label>
          {t('课程简称')}
          <input name="code" required maxLength={12} />
        </label>
        <label>
          {t('授课教师')}
          <input name="teacher" required maxLength={80} />
        </label>
      </div>
      <label>
        {t('课程简介')}
        <textarea name="description" maxLength={300} rows={2} />
      </label>
      <label>
        {t('课程颜色')}
        <select name="color">
          <option value="#6f8264">{t('鼠尾草绿')}</option>
          <option value="#64899b">{t('雾蓝')}</option>
          <option value="#b08962">{t('砂棕')}</option>
          <option value="#8d7aa2">{t('灰紫')}</option>
        </select>
      </label>
      {error && <Alert>{t(error)}</Alert>}
      <button className="cp-button primary">{t('创建课程')}</button>
    </form>
  );
}
function NewAssignment({
  courses,
  onSave,
}: {
  courses: CampusCourse[];
  onSave: (a: Assignment) => void;
}) {
  const { t } = useI18n();
  const [error, setError] = useState('');
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const start = String(d.get('start')),
      due = String(d.get('due'));
    if (start > due) {
      setError('开始日期不能晚于截止日期。');
      return;
    }
    const lines = String(d.get('steps'))
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length < 1) {
      setError('请至少填写一个作业步骤。');
      return;
    }
    const id = uid();
    onSave({
      id,
      courseId: String(d.get('course')),
      title: String(d.get('title')).trim(),
      brief: String(d.get('brief')).trim(),
      startsOn: start,
      due,
      deadlineVerified: true,
      category: 'coursework',
      steps: lines.map((title, i) => ({
        id: `${id}-step-${i}`,
        title,
        minutes: 30,
        day: i,
        done: false,
        blocked: false,
        evidence: '',
        source: '',
      })),
    });
  }
  return (
    <form className="cp-form" onSubmit={submit}>
      <label>
        {t('归属课程')}
        <select name="course">
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} · {t(c.name)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('作业标题')}
        <input name="title" required maxLength={150} />
      </label>
      <div className="cp-form-row">
        <label>
          {t('开始日期')}
          <input
            name="start"
            type="date"
            required
            defaultValue={isoDate(new Date())}
          />
        </label>
        <label>
          {t('截止日期')}
          <input name="due" type="date" required />
        </label>
      </div>
      <label>
        {t('作业要求')}
        <textarea name="brief" required maxLength={12000} rows={3} />
      </label>
      <label>
        {t('作业步骤（每行一步）')}
        <textarea
          name="steps"
          required
          maxLength={4000}
          rows={4}
          placeholder={t('阅读要求\n准备材料\n完成草稿\n检查并提交')}
        />
      </label>
      {error && <Alert>{t(error)}</Alert>}
      <button className="cp-button primary">{t('发布给学生')}</button>
    </form>
  );
}
