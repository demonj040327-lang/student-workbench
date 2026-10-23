
import { createCourse, getCourses } from './database.mjs';
import { randomUUID } from 'node:crypto';

export function createCampusMiddleware() {
  return async function campusMiddleware(req, res, next) {
    const path = new URL(
      req.url || '/',
      'http://localhost'
    ).pathname;

    if (path !== '/api/campus/courses') {
      return next();
    }

    res.setHeader('Content-Type', 'application/json');

    const send = (status, data) => {
      res.statusCode = status;
      res.end(JSON.stringify(data));
    };

    // 本机 GET：获取课程
    if (req.method === 'GET') {
      return send(200, { courses: getCourses() });
    }

    // 在接入身份认证与同源防护之前，
    // 暂不开放从浏览器写入数据库的接口。
    if (req.method !== 'POST') {
      return send(405, { error: 'Method not allowed' });
    }

    return send(501, {
      error: '课程写入 API 尚未启用'
    });
  };
}
