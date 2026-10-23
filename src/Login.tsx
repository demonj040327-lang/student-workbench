
import { useState } from 'react';
import './login.css';

export type UserRole = 'teacher' | 'student';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [role, setRole] = useState<UserRole>('student');

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-logo">▥</div>

        <h1>Student Workbench</h1>
        <p className="login-subtitle">
          智能校园学习与教学平台
        </p>

        <h2>欢迎使用</h2>
        <p>请选择你的身份，进入对应的工作空间。</p>

        <div className="login-role-options">
          <button
            type="button"
            className={role === 'student' ? 'selected' : ''}
            onClick={() => setRole('student')}
          >
            <span>🎓</span>
            <strong>学生</strong>
            <small>课程学习与 AI 问答</small>
          </button>

          <button
            type="button"
            className={role === 'teacher' ? 'selected' : ''}
            onClick={() => setRole('teacher')}
          >
            <span>📚</span>
            <strong>教师</strong>
            <small>课程管理与 AI 教学</small>
          </button>
        </div>

        <button
          className="login-submit"
          onClick={() => onLogin(role)}
        >
          进入{role === 'teacher' ? '教师' : '学生'}工作空间 →
        </button>

        <p className="login-footer">
          TeachAthon 2026 · 演示登录
        </p>
      </div>
    </div>
  );
}
