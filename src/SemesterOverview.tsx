import {useI18n} from './i18n';
import {useEffect, useRef, useState, type CSSProperties} from 'react';
import type {Assignment, Course, Semester} from './data';
import {courseAccent} from './courseTheme';

type Props = {
  courses: Course[]; assignments: Assignment[]; semester: Semester; anchor?: string;
  onOpen: (assignment: Assignment) => void; onAdd: () => void; onSettings: () => void; addLabel?:string;
};
const DAY = 86400000;

export function monthDayNumber(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const date = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isFinite(date) && new Date(date).toISOString().slice(0, 10) === value ? date : NaN;
}
function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function shortDate(value: string, locale='zh-CN') {
  return value ? new Intl.DateTimeFormat(locale,{month:'short',day:'numeric'}).format(new Date(`${value}T12:00:00`)) : '待确认';
}
function toDate(value: number) { return new Date(value).toISOString().slice(0, 10); }
export function courseworkProgress(assignment: Assignment) {
  return assignment.steps.length ? Math.round(assignment.steps.filter(step => step.done).length / assignment.steps.length * 100) : 0;
}
export function plannedStart(assignment: Assignment, anchor?: string) {
  if (assignment.startsOn) return {date: monthDayNumber(assignment.startsOn), kind: '指定开始日'};
  const days = assignment.steps.map(step => step.day).filter(Number.isFinite);
  return {date: anchor && days.length ? monthDayNumber(anchor) + Math.min(...days) * DAY : NaN, kind: '个人计划起点'};
}
function localMidnight(value: string, nextDay = false) {
  if (!Number.isFinite(monthDayNumber(value))) return NaN;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day + (nextDay ? 1 : 0)).getTime();
}
export function semesterElapsed(semester: Semester, now: number) {
  const start = localMidnight(semester.start), end = localMidnight(semester.end, true);
  return Number.isFinite(start) && end > start ? Math.max(0, Math.min(100, (now - start) / (end - start) * 100)) : 0;
}

// Isolate the live clock so the chart does not rerender five times a second.
function SemesterClock({semester}: {semester: Semester}) {
  const {t,locale}=useI18n();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    function schedule() {
      if (timer) clearInterval(timer);
      timer = undefined;
      if (document.visibilityState !== 'hidden') {
        setNow(Date.now());
        timer = setInterval(() => setNow(Date.now()), 200);
      }
    }
    schedule();
    document.addEventListener('visibilitychange', schedule);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', schedule); };
  }, []);
  const elapsed = semesterElapsed(semester, now);
  return <div className="semester-clock">
    <div><span>{t("学期时间已过")}</span><strong data-testid="semester-elapsed" data-clock-ms={now}>{elapsed.toFixed(8)}<small>%</small></strong></div>
    <div className="semester-clock-track" role="progressbar" aria-label={t("学期时间已过")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(elapsed)}><i style={{width: `${elapsed}%`}}/></div>
  </div>;
}

export default function SemesterOverview({courses, assignments, semester, anchor, onOpen, onAdd, onSettings, addLabel='添加作业'}: Props) {
  const {t,locale}=useI18n();
  const [filter, setFilter] = useState('all');
  const [todayDate, setTodayDate] = useState(localToday);
  const chartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const refresh = () => setTodayDate(localToday());
    const timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const today = monthDayNumber(todayDate);
  const start = monthDayNumber(semester.start), end = monthDayNumber(semester.end);
  const currentWeek = today >= start && today <= end ? Math.floor((today - start) / (7 * DAY)) + 1 : null;
  const startDate = new Date(Number.isFinite(start) ? start : today);
  const endDate = new Date(Number.isFinite(end) ? end : today);
  const rangeStart = Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1);
  const rangeEnd = Math.max(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, 1), Date.UTC(startDate.getUTCFullYear() + 1, 1, 1));
  const span = rangeEnd - rangeStart;
  const position = (date: number) => (date - rangeStart) / span * 100;
  const months: {date: number; next: number; label: string}[] = [];
  for (let date = rangeStart; date < rangeEnd && months.length < 24;) {
    const month = new Date(date), next = Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1);
    months.push({date, next, label: new Intl.DateTimeFormat(locale,{month:'short',timeZone:'UTC'}).format(month)}); date = next;
  }
  const activeFilter = courses.some(course => course.id === filter) ? filter : 'all';
  const selected = assignments.filter(assignment => activeFilter === 'all' || assignment.courseId === activeFilter);
  const pending = selected.filter(assignment => !Number.isFinite(monthDayNumber(assignment.due)));
  const invalid = selected.filter(assignment => {
    const due = monthDayNumber(assignment.due), plan = plannedStart(assignment, anchor).date;
    return Number.isFinite(due) && Number.isFinite(plan) && plan > due;
  });
  const outside = selected.filter(assignment => {
    const due = monthDayNumber(assignment.due);
    return Number.isFinite(due) && (due < rangeStart || due >= rangeEnd) && !invalid.includes(assignment);
  });
  const dated = selected.filter(assignment => Number.isFinite(monthDayNumber(assignment.due)) && !invalid.includes(assignment) && !outside.includes(assignment));
  const complete = assignments.filter(assignment => assignment.steps.length > 0 && assignment.steps.every(step => step.done)).length;
  const upcoming = assignments.filter(assignment => monthDayNumber(assignment.due) >= today && courseworkProgress(assignment) < 100).sort((a, b) => a.due.localeCompare(b.due));
  const nearby = upcoming.filter(assignment => monthDayNumber(assignment.due) <= today + 14 * DAY).length;
  const next = upcoming[0];
  const nextCourse = courses.find(course => course.id === next?.courseId);
  const groups = courses.filter(course => activeFilter === 'all' || course.id === activeFilter).map(course => ({course, items: dated.filter(assignment => assignment.courseId === course.id).sort((a, b) => a.due.localeCompare(b.due))}));
  const orphaned = dated.filter(assignment => !courses.some(course => course.id === assignment.courseId));
  if (orphaned.length) groups.push({course: {id: 'unclassified', name: '其他个人安排', code: t('个人'), subject: '', color: '#a1a1a6'}, items: orphaned});
  const todayVisible = today >= rangeStart && today < rangeEnd;

  function locateToday() {
    const chart = chartRef.current;
    const line = chart?.querySelector<HTMLElement>('[data-testid="today-timeline-line"]');
    if (!chart || !line) return;
    const target = chart.scrollLeft + line.getBoundingClientRect().left - chart.getBoundingClientRect().left - chart.clientWidth / 2;
    chart.scrollTo({left: Math.max(0, target), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  }
  function issueItem(assignment: Assignment, label: string) {
    const course = courses.find(course => course.id === assignment.courseId);
    return <button className="date-issue" key={assignment.id} onClick={() => onOpen(assignment)} data-assignment-id={assignment.id}>
      <span className="date-issue-dot" style={{background: course ? courseAccent(course) : '#a1a1a6'}}/>
      <span><strong>{assignment.title}</strong><small>{course?.code ||t("未分类")} · {label}</small></span>
      <span className="date-issue-action">{t("查看详情")}{' '}<span aria-hidden="true">↗</span></span>
    </button>;
  }

  return <section className="semester-overview">
    <div className="semester-hero">
      <div className="semester-hero-copy"><span className="semester-kicker">{semester.name}<i/>{currentWeek ?t("第 {v0} 周", {v0: currentWeek}) : today < start ?t("尚未开始") :t("学期已结束")}</span>
        <h1>{t("学期总览")}</h1><p>{t("在同一条时间轴上，看清每门课的大作业。")}</p>
      </div>
      <div className="semester-hero-actions"><button className="button button-primary" onClick={onAdd}><span aria-hidden="true">＋</span>{t(addLabel)}</button><button className="button button-secondary" onClick={onSettings}>{t("学期设置")}<span aria-hidden="true">↗</span></button></div>
    </div>
    <div className="semester-at-a-glance" aria-label={t("学期概况")}>
      <div><strong>{String(courses.length).padStart(2, '0')}</strong><span>{t("门课程")}</span></div>
      <div><strong>{String(assignments.length).padStart(2, '0')}<small> / {complete}{' '}{t("已完成")}</small></strong><span>{t("作业与检查点")}</span></div>
      <div><strong>{String(nearby).padStart(2, '0')}</strong><span>{t("两周内截止")}</span></div>
      <button className="semester-next-due" disabled={!next} onClick={() => next && onOpen(next)}><strong>{next ? shortDate(next.due,locale) : '—'}<span aria-hidden="true">↗</span></strong><span>{next ?t("下一次提交 · {v0}", {v0: nextCourse?.code ||t("未分类")}) :t("暂无待提交作业")}</span></button>
    </div>

    <section className="timeline-card" aria-labelledby="timeline-title">
      <div className="timeline-card-heading"><div><h2 id="timeline-title">{t("学期作业进度")}</h2><p>{semester.start.replaceAll('-', '.')} — {semester.end.replaceAll('-', '.')}</p></div><SemesterClock semester={semester}/></div>
      <div className="timeline-toolbar"><div className="timeline-filters" aria-label={t("按课程筛选作业")}><button className={activeFilter === 'all' ? 'active' : ''} aria-pressed={activeFilter === 'all'} onClick={() => setFilter('all')}>{t("全部课程")}</button>{courses.map(course => <button key={course.id} className={activeFilter === course.id ? 'active' : ''} aria-pressed={activeFilter === course.id} onClick={() => setFilter(course.id)}><i style={{background: courseAccent(course)}}/>{course.code}</button>)}</div>{todayVisible && <button className="timeline-today-button" data-testid="month-locate-today" onClick={locateToday}>{t("定位今天")}{' '}<span aria-hidden="true">⌖</span></button>}</div>
      <div className="timeline-scroll" ref={chartRef} tabIndex={0} role="region" aria-label={t("按课程分组的学期作业时间图，可左右滚动")} data-testid="month-chart" data-range-start={toDate(rangeStart)} data-range-end={toDate(rangeEnd - DAY)}>
        <div className="timeline-plot">
          <div className="timeline-month-ruler" aria-label={t("月份刻度")}>{months.map(month=><span key={month.date} style={{left:`${position(month.date)}%`,width:`${(month.next-month.date)/span*100}%`}}>{month.label}</span>)}</div>
          {todayVisible && <div className="timeline-today-spine" data-testid="today-timeline-line" style={{left: `${position(today)}%`}}><span>{t("今天 ·")}{' '}{shortDate(todayDate,locale)}</span></div>}
          <div className="timeline-rows">{groups.map(({course, items}) => {
            const courseAssignments = selected.filter(assignment => assignment.courseId === course.id);
            const steps = courseAssignments.flatMap(assignment => assignment.steps), done = steps.filter(step => step.done).length;
            const coursePending = pending.filter(assignment => assignment.courseId === course.id);
            return <div className="timeline-course" key={course.id} style={{'--lane-color': courseAccent(course)} as CSSProperties} data-course-id={course.id}>
              <div className="timeline-course-heading"><span className="timeline-course-identity"><i/><strong>{course.code}</strong><span title={course.name}>{course.name}</span></span><span className="timeline-course-total">{done} / {steps.length}{' '}{t("步已完成")}</span></div>
              {items.map(assignment => {
                const pct = courseworkProgress(assignment), due = monthDayNumber(assignment.due), plan = plannedStart(assignment, anchor), hasStart = Number.isFinite(plan.date);
                const left = position(Math.max(rangeStart, hasStart ? plan.date : due));
                const width = hasStart ? position(due + DAY) - left : 0;
                return <div className="timeline-assignment" key={assignment.id} data-assignment-id={assignment.id} data-progress={pct} data-start={hasStart ? toDate(plan.date) : ''} data-due={assignment.due}>
                  <div className="timeline-assignment-info"><button onClick={() => onOpen(assignment)}>{assignment.title}<span aria-hidden="true">↗</span></button><span>{t("{v0} 截止",{v0:shortDate(assignment.due,locale)})}{!assignment.deadlineVerified ?t(" · 待核对") : ''}<b>{pct}%</b></span></div>
                  <div className="timeline-lane"><span className="timeline-rail"/>{hasStart ? <button className={`timeline-interval ${pct === 100 ? 'is-complete' : ''}`} style={{left: `${left}%`, width: `${width}%`}} onClick={() => onOpen(assignment)} aria-label={t("{v0}，{v1} {v2} 至 {v3}，{v4}%完成", {v0: assignment.title, v1: t(plan.kind), v2: toDate(plan.date), v3: assignment.due, v4: pct})} title={t("{v0} {v1} → {v2} · {v3}% 完成", {v0: t(plan.kind), v1: toDate(plan.date), v2: assignment.due, v3: pct})}><span className="timeline-interval-progress" style={{width: `${pct}%`}}/></button> : <button className="timeline-deadline-point" style={{left: `${position(due)}%`}} onClick={() => onOpen(assignment)} aria-label={t("{v0}，{v1}截止，开始日期待确认，{v2}%完成", {v0: assignment.title, v1: assignment.due, v2: pct})}/>}</div>
                </div>;
              })}
              {!items.length && <div className="timeline-unplanned"><span className="timeline-rail"/>{coursePending.length ? <button onClick={() => onOpen(coursePending[0])}>{coursePending.length}{' '}{t("项作业，截止日期待确认")}{' '}<span aria-hidden="true">↗</span></button> : <span>{t("暂无已确认的时间安排")}</span>}</div>}
              {items.length > 0 && coursePending.length > 0 && <button className="timeline-pending-link" onClick={() => onOpen(coursePending[0])}>{t("另有")}{' '}{coursePending.length}{' '}{t("项日期待确认")}{' '}<span aria-hidden="true">↗</span></button>}
            </div>;
          })}</div>
          <div className="timeline-axis" aria-label={t("日历时间轴")}><div className="timeline-axis-line"/>{months.map(month => <div className="timeline-axis-month" key={month.date} style={{left: `${position(month.date)}%`, width: `${(month.next - month.date) / span * 100}%`}}><span>{month.label}</span><small>{new Date(month.date).getUTCFullYear()}</small><i/></div>)}<span className="timeline-axis-arrow" aria-hidden="true">▸</span></div>
        </div>
      </div>
      <div className="timeline-card-footer"><span><i className="timeline-legend-interval"/>{t("彩条为个人计划区间")}<i className="timeline-legend-progress"/>{t("深色填充为完成比例")}</span><span className="timeline-scroll-hint">{t("左右滑动查看时间轴")}{' '}<span aria-hidden="true">↔</span></span><span className="timeline-range-caption">{startDate.getUTCFullYear()} — {new Date(rangeEnd - DAY).getUTCFullYear()}</span></div>
    </section>

    {(pending.length > 0 || invalid.length > 0 || outside.length > 0) && <details className="date-issues"><summary><span>{t("还有一些日期，等你确认。")}<small>{pending.length + invalid.length + outside.length}{' '}{t("项")}</small></span><span className="date-issues-expand">{t("展开")}{' '}<span aria-hidden="true">＋</span></span></summary><div className="date-issues-content">{pending.map(assignment => issueItem(assignment,t("截止日期待确认")))}{invalid.map(assignment => issueItem(assignment,t("计划起点晚于截止日，请调整日期")))}{outside.map(assignment => issueItem(assignment,t("{v0} 截止 · 图示范围之外", {v0: shortDate(assignment.due,locale)})))}</div></details>}
    {!selected.length && <div className="semester-empty"><p>{t("这门课程还没有作业，从添加第一项开始。")}</p><button className="text-button" onClick={onAdd}>{t("添加作业")}{' '}<span aria-hidden="true">＋</span></button></div>}
  </section>;
}
