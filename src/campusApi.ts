
import type { CampusCourse } from './campusStore';

type CoursesResponse = {
  courses: CampusCourse[];
};

export async function fetchDatabaseCourses(): Promise<CampusCourse[]> {
  const response = await fetch('/api/campus/courses', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`课程数据库请求失败：HTTP ${response.status}`);
  }

  const data: unknown = await response.json();

  if (
    !data ||
    typeof data !== 'object' ||
    !('courses' in data) ||
    !Array.isArray(data.courses)
  ) {
    throw new Error('服务器返回的课程数据格式无效');
  }

  return data.courses as CampusCourse[];
}

export async function fetchDemoTeacherCourses(): Promise<CampusCourse[]> {
  const courses = await fetchDatabaseCourses();

  return courses
    .filter((course) => course.instructorId === 'teacher-demo')
    .map((course) => ({
      ...course,
      instructorId: 'local-teacher',
    }));
}

export async function createDatabaseCourse(
  course: Omit<CampusCourse, 'id'>
): Promise<CampusCourse> {
  const response = await fetch('/api/campus/courses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify({
      ...course,
      teacherId: 'teacher-demo',
    }),
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    const message =
      data &&
      typeof data === 'object' &&
      'error' in data &&
      typeof data.error === 'string'
        ? data.error
        : `HTTP ${response.status}`;

    throw new Error(`课程创建失败：${message}`);
  }

  if (
    !data ||
    typeof data !== 'object' ||
    !('course' in data) ||
    !data.course ||
    typeof data.course !== 'object' ||
    !('id' in data.course) ||
    typeof data.course.id !== 'string'
  ) {
    throw new Error('服务器返回的课程信息无效');
  }

  return {
    ...(data.course as CampusCourse),
    instructorId: 'local-teacher',
  };
}
