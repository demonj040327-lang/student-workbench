
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
  db.prepare(`
    INSERT INTO courses (id, name, code, teacher_id)
    VALUES (?, ?, ?, ?)
  `).run(
    course.id,
    course.name,
    course.code,
    course.teacherId
  );
}

export function getCourses() {
  return db.prepare('SELECT * FROM courses').all();
}

export function updateCourse(id, name) {
  return db.prepare(`
    UPDATE courses SET name = ? WHERE id = ?
  `).run(name, id);
}

export function deleteCourse(id) {
  return db.prepare(`
    DELETE FROM courses WHERE id = ?
  `).run(id);
}

export function closeDatabase() {
  db.close();
}
