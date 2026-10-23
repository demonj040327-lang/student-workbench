
import {
  createCourse,
  getCourses,
  updateCourse,
  deleteCourse
} from './database.mjs';

import { randomUUID } from 'node:crypto';

const MAX_BODY_BYTES = 8192;


function toCampusCourse(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    instructorId: row.teacher_id,
    teacher: row.teacher,
    description: row.description,
    subject: row.subject,
    color: row.color,
    materialName: row.material_name ?? undefined,
    topic: row.topic ?? undefined
  };
}


export function createCampusMiddleware() {
  return async function campusMiddleware(req, res, next) {
    const path = new URL(
      req.url || '/',
      'http://localhost'
    ).pathname;

    const base = '/api/campus/courses';

    if (path !== base && !path.startsWith(`${base}/`)) {
      return next();
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');

    const send = (status, data) => {
      res.statusCode = status;
      res.end(JSON.stringify(data));
    };

    // 保留现有课程查询功能

    if (req.method === 'GET' && path === base) {
      return send(200, {
        courses: getCourses().map(toCampusCourse)
      });
    }


    const allowedMethods = ['POST', 'PATCH', 'DELETE'];

    if (!allowedMethods.includes(req.method)) {
      return send(405, { error: 'Method not allowed' });
    }

    // 默认禁止修改，仅允许明确开启的本机开发测试
    if (
      process.env.CAMPUS_DEV_WRITES !== 'true' ||
      process.env.NODE_ENV === 'production'
    ) {
      return send(403, {
        error: '课程写入功能未启用'
      });
    }

    const host = req.headers.host || '';
    const hostname = host.split(':')[0];

    // 只接受通过本机回环地址访问的请求
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(hostname)) {
      return send(403, { error: '仅支持本机测试' });
    }

    const origin = req.headers.origin;
    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host ||
            !['http:', 'https:'].includes(originUrl.protocol)) {
          return send(403, { error: '跨站写入被拒绝' });
        }
      } catch {
        return send(403, { error: '无效请求来源' });
      }
    }

    // 只接受 JSON 请求体
    if (['POST', 'PATCH'].includes(req.method)) {
      if (
        !req.headers['content-type']
          ?.toLowerCase()
          .startsWith('application/json')
      ) {
        return send(415, { error: '需要 JSON 请求体' });
      }
    }

    const readBody = async () => {
      let size = 0;
      const chunks = [];

      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          const error = new Error('请求体过大');
          error.status = 413;
          throw error;
        }
        chunks.push(chunk);
      }

      try {
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        const error = new Error('JSON 格式错误');
        error.status = 400;
        throw error;
      }
    };

    try {
      // 创建课程

      // 创建课程
      if (req.method === 'POST' && path === base) {
        const body = await readBody();

        const validText = (value, max, required = false) =>
          typeof value === 'string' &&
          value.length <= max &&
          (!required || value.trim().length > 0);

        if (
          !body ||
          typeof body !== 'object' ||
          Array.isArray(body) ||
          !validText(body.name, 80, true) ||
          !validText(body.code, 12, true) ||
          !validText(body.teacher ?? '', 80) ||
          !validText(body.description ?? '', 300) ||
          !validText(body.subject ?? '', 80) ||
          !validText(body.color ?? '#6f8264', 20) ||
          !validText(body.materialName ?? '', 255) ||
          !validText(body.topic ?? '', 200) ||
          body.teacherId !== 'teacher-demo'
        ) {
          return send(400, { error: '课程参数无效' });
        }

        const color = body.color ?? '#6f8264';

        if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
          return send(400, { error: '课程颜色格式无效' });
        }

        const course = {
          id: randomUUID(),
          name: body.name.trim(),
          code: body.code.trim(),
          teacherId: 'teacher-demo',
          teacher: (body.teacher ?? '').trim(),
          description: (body.description ?? '').trim(),
          subject: (body.subject ?? '').trim(),
          color,
          materialName: body.materialName ?? null,
          topic: body.topic ?? null
        };

        createCourse(course);

        // 返回前端 CampusCourse 使用的字段格式
        return send(201, {
          course: {
            id: course.id,
            name: course.name,
            code: course.code,
            teacher: course.teacher,
            instructorId: course.teacherId,
            description: course.description,
            subject: course.subject,
            color: course.color,
            materialName: course.materialName,
            topic: course.topic
          }
        });
      }





      const match = path.match(
        /^\/api\/campus\/courses\/([a-zA-Z0-9-]+)$/
      );

      if (!match) {
        return send(404, { error: '课程接口不存在' });
      }

      const courseId = match[1];

      // 修改课程名称
      if (req.method === 'PATCH') {
        const body = await readBody();

        if (
          !body ||
          typeof body.name !== 'string' ||
          !body.name.trim() ||
          body.name.trim().length > 80
        ) {
          return send(400, { error: '课程名称无效' });
        }

        const updated = updateCourse(courseId, body.name);

        return updated
          ? send(200, { updated: true })
          : send(404, { error: '课程不存在' });
      }

      // 删除课程
      if (req.method === 'DELETE') {
        const deleted = deleteCourse(courseId);

        return deleted
          ? send(200, { deleted: true })
          : send(404, { error: '课程不存在' });
      }

      return send(405, { error: 'Method not allowed' });
    } catch (error) {
      return send(error.status || 500, {
        error: error.status
          ? error.message
          : '数据库操作失败'
      });
    }
  };
}
