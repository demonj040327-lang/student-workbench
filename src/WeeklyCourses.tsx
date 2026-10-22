import {useI18n} from './i18n';
import type {Assignment, Course} from './data';
import {mondayOf, shiftDate} from './data';
import {courseAccent} from './courseTheme';

type Props = {courses: Course[]; assignments: Assignment[]; anchor: string; onCourse: (id: string) => void; onStep: (aid: string, sid: string, done: boolean) => void};
export default function WeeklyCourses({courses, assignments, anchor, onCourse, onStep}: Props) {
  const {t,locale}=useI18n();
  const monday = mondayOf(new Date());
  const first = Math.round((new Date(`${monday}T12:00:00`).getTime() - new Date(`${anchor}T12:00:00`).getTime()) / 86400000);
  const label = (date: string) => new Intl.DateTimeFormat(locale,{month:'short',day:'numeric'}).format(new Date(`${date}T12:00:00`));
  return <section className="weekly-courses" aria-labelledby="weekly-courses-title">
    <div className="weekly-courses-heading"><div><span className="section-kicker">THIS WEEK</span><h2 id="weekly-courses-title">{t("本周课程任务")}</h2></div><span>{label(monday)} — {label(shiftDate(monday, 6))}</span></div>
    <div className="weekly-courses-grid">{courses.map((course, index) => {
      const tasks = assignments.filter(assignment => assignment.courseId === course.id).flatMap(assignment => assignment.steps.filter(step => step.day >= first && step.day < first + 7).map(step => ({assignment, step}))).sort((a, b) => Number(a.step.done) - Number(b.step.done) || a.step.day - b.step.day);
      const done = tasks.filter(task => task.step.done).length;
      return <article key={course.id} className="weekly-course" style={{'--weekly-color': courseAccent(course)} as React.CSSProperties}>
        <button className="weekly-course-open" onClick={() => onCourse(course.id)}><span className="weekly-course-code"><span><i/>{course.code}</span><small>{String(index + 1).padStart(2, '0')}</small></span><strong>{course.name}</strong><span className="weekly-course-subject">{course.subject}</span></button>
        <div className="weekly-course-tasks">{tasks.slice(0, 2).map(({assignment, step}) => <div key={step.id} className={step.done ? 'done' : ''}><button className="weekly-step-check" aria-label={`${step.done ?t("恢复") :t("完成")}：${step.title}`} aria-pressed={step.done} onClick={() => onStep(assignment.id, step.id, !step.done)}>{step.done ? '✓' : ''}</button><span><strong>{step.title}</strong><small>{assignment.planOnly ?t("课后复习") :t("作业步骤")} · {step.minutes}{' '}{t("分钟")}</small></span></div>)}{!tasks.length && <p>{t("本周暂无计划步骤。")}</p>}</div>
        <div className="weekly-course-footer"><span>{done}<small> / {tasks.length}{' '}{t("步完成")}</small></span><button onClick={() => onCourse(course.id)} aria-label={t("打开 {v0} 课程", {v0: course.code})}>{tasks.length > 2 ?t("全部 {v0} 步", {v0: tasks.length}) :t("查看作业")}<span aria-hidden="true">↗</span></button></div>
      </article>;
    })}</div>
  </section>;
}
