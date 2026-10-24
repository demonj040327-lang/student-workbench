export function allowedClassroomOrigin(req) {
  try {
    const host = new URL(`http://${req.headers.host}`);
    return (
      ['localhost', '127.0.0.1', '[::1]'].includes(host.hostname) &&
      req.headers.origin === host.origin &&
      (!req.socket?.remoteAddress ||
        ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
          req.socket.remoteAddress,
        ))
    );
  } catch {
    return false;
  }
}
export function classroomProxy() {
  return {
    '/api/classroom/asr': {
      target: 'ws://127.0.0.1:8000',
      ws: true,
      rewrite: (path) => path.replace(/^\/api\/classroom\/asr/, '/asr'),
      configure(proxy) {
        proxy.on('proxyReqWs', (outgoing, req, socket) => {
          if (!allowedClassroomOrigin(req)) {
            outgoing.destroy();
            socket.destroy();
          }
        });
      },
    },
  };
}
