
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const databasePath = join(root, 'data', 'workbench.db');

mkdirSync(dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('teacher', 'student'))
  );

  CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    student_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    PRIMARY KEY (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
  );
`);


const courseColumns = new Set(
  db.prepare('PRAGMA table_info(courses)')
    .all()
    .map((column) => column.name)
);

const extraColumns = {
  teacher: "TEXT NOT NULL DEFAULT ''",
  description: "TEXT NOT NULL DEFAULT ''",
  subject: "TEXT NOT NULL DEFAULT ''",
  color: "TEXT NOT NULL DEFAULT '#6f8264'",
  material_name: 'TEXT',
  topic: 'TEXT'
};

for (const [name, definition] of Object.entries(extraColumns)) {
  if (!courseColumns.has(name)) {
    db.exec(`ALTER TABLE courses ADD COLUMN ${name} ${definition}`);
  }
}


export function createUser(user) {
  db.prepare(`
    INSERT INTO users (id, username, display_name, role)
    VALUES (?, ?, ?, ?)
  `).run(user.id, user.username, user.displayName, user.role);
}

export function getUsers() {
  return db.prepare('SELECT * FROM users').all();
}


export function createCourse(course) {
  const result = db.prepare(`
    INSERT INTO courses (
      id,
      name,
      code,
      teacher_id,
      teacher,
      description,
      subject,
      color,
      material_name,
      topic
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    course.id,
    course.name,
    course.code,
    course.teacherId,
    course.teacher ?? '',
    course.description ?? '',
    course.subject ?? '',
    course.color ?? '#6f8264',
    course.materialName ?? null,
    course.topic ?? null
  );

  return result.changes > 0;
}


export function getCourses() {
  return db.prepare('SELECT * FROM courses').all();
}


export function updateCourse(id, name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 80) {
    throw new Error('课程名称必须为 1–80 个字符');
  }

  const result = db.prepare(`
    UPDATE courses
    SET name = ?
    WHERE id = ?
  `).run(name.trim(), id);

  return result.changes > 0;
}



export function deleteCourse(id) {
  // 使用事务保证关联记录和课程删除同时成功
  db.exec('BEGIN IMMEDIATE');

  try {
    db.prepare(`
      DELETE FROM enrollments
      WHERE course_id = ?
    `).run(id);

    const result = db.prepare(`
      DELETE FROM courses
      WHERE id = ?
    `).run(id);

    db.exec('COMMIT');
    return result.changes > 0;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}


export function closeDatabase() {
  db.close();
}
