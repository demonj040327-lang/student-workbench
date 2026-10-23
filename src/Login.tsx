import {useState} from 'react';
import {LanguageSwitcher,useI18n} from './i18n';
import Icon from './CampusIcons';
import './login.css';
export type UserRole='teacher'|'student';
export default function Login({onLogin}:{onLogin:(role:UserRole)=>void}) {
 const [role,setRole]=useState<UserRole>('student');const {t}=useI18n();
 return <div className="login-page"><div className="login-panel">
  <div className="login-language"><LanguageSwitcher/></div>
  <img className="login-logo" src="/workbench-logo.svg" alt="workbench logo" width="60" height="60"/>
  <h1>workbench.</h1><p className="login-subtitle">{t('课程学习与教学工作台')}</p>
  <h2>{t('欢迎使用')}</h2><p>{t('请选择你的身份，进入对应的工作空间。')}</p>
  <div className="login-role-options" aria-label={t('选择演示身份')}>
   <button type="button" className={role==='student'?'selected':''} aria-pressed={role==='student'} onClick={()=>setRole('student')}><Icon name="book" size={28}/><strong>{t('学生')}</strong><small>{t('课程学习与 AI 问答')}</small></button>
   <button type="button" className={role==='teacher'?'selected':''} aria-pressed={role==='teacher'} onClick={()=>setRole('teacher')}><Icon name="layers" size={28}/><strong>{t('教师')}</strong><small>{t('课程管理与 AI 教学')}</small></button>
  </div>
  <button className="login-submit" onClick={()=>onLogin(role)}>{t(role==='teacher'?'进入教师工作空间':'进入学生工作空间')} →</button>
  <p className="login-footer">TeachAthon 2026 · {t('演示登录')}</p>
 </div></div>;
}
