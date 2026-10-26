// Start the local classroom stack; reuse a speech service already running on 8000.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
let speech,
  web,
  stopping = false;
try {
  const response = await fetch('http://127.0.0.1:8000/health', {
    signal: AbortSignal.timeout(1500),
  });
  if (!response.ok || !(await response.json()).ready) throw Error('not ready');
  console.log('Using the speech service already running on port 8000.');
} catch {
  speech = spawn('/bin/sh', ['tools/start-local-speech.sh'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, SPEECH_PORT: '8000' },
  });
  speech.on('error', () =>
    console.error(
      'Speech service could not start. See docs/LOCAL_SPEECH_SETUP.md.',
    ),
  );
  speech.on('exit', (code) => {
    if (code && !stopping)
      console.error(
        'Speech service stopped. Audio-only recording remains available.',
      );
  });
}
const extra = process.argv.slice(2);
web = spawn(
  process.execPath,
  [
    'node_modules/vite/bin/vite.js',
    '--host',
    '127.0.0.1',
    ...(extra.length ? extra : ['--port', '5175', '--strictPort']),
  ],
  { cwd: root, stdio: 'inherit' },
);
function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  web?.kill(signal);
  speech?.kill(signal);
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
web.on('error', () => {
  stop();
  process.exitCode = 1;
});
web.on('exit', (code) => {
  stop();
  process.exitCode = code || 0;
});
