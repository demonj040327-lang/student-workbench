import test from 'node:test';
import assert from 'node:assert/strict';
import { processClassroomText } from './study-api.mjs';
import { allowedClassroomOrigin } from './classroom-proxy.mjs';
const payload = {
  task: 'translate',
  text: 'A theme describes a pattern.',
  targetLanguage: 'zh',
  credentialScope: 'student',
  allowExternal: true,
  personalApi: {
    provider: 'deepseek',
    key: 'student-test-key',
    model: 'deepseek-flash',
  },
};
const env = {
  ELM_API_KEY: 'teacher-test-key',
  ELM_MODEL: 'teacher-model',
  ELM_BASE_URL: 'https://elm.edina.ac.uk/api/v1',
};
test('classroom text requires personal credentials, external consent and explicit edited-translation confirmation', async () => {
  await assert.rejects(
    processClassroomText({ ...payload, credentialScope: 'teacher' }, { env }),
    /学生自己的 API/,
  );
  await assert.rejects(
    processClassroomText({ ...payload, personalApi: null }, { env }),
    /自己的 API/,
  );
  await assert.rejects(
    processClassroomText({ ...payload, allowExternal: false }, { env }),
    /允许/,
  );
  await assert.rejects(
    processClassroomText({ ...payload, task: 'explain' }, { env }),
    /确认译文/,
  );
  await assert.rejects(
    processClassroomText({ ...payload, text: 'x'.repeat(12001) }, { env }),
    /课堂文字/,
  );
  await assert.rejects(
    processClassroomText({ ...payload, targetLanguage: 'invalid' }, { env }),
    /语言/,
  );
});
test('translation uses the fixed DeepSeek endpoint and explanation receives exactly the edited translation', async () => {
  const previous = globalThis.fetch;
  const requests = [];
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.deepseek.com/chat/completions');
      assert.equal(options.headers.Authorization, 'Bearer student-test-key');
      const body = JSON.parse(options.body);
      requests.push(body);
      assert(!JSON.stringify(body).includes('teacher-test-key'));
      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content:
                  requests.length === 1
                    ? '主题描述一种模式。'
                    : '根据已修订译文生成的讲解。',
              },
            },
          ],
        }),
      );
    };
    assert.equal(
      (await processClassroomText(payload, { env })).text,
      '主题描述一种模式。',
    );
    const edited = '人工修订：主题不仅是标签，还需呈现与研究问题有关的模式。';
    await processClassroomText(
      {
        ...payload,
        task: 'explain',
        text: edited,
        confirmedTranslation: true,
        originalTranscript: 'This original must not be forwarded.',
      },
      { env },
    );
    assert.equal(JSON.parse(requests[1].messages[1].content).text, edited);
    assert(
      !JSON.stringify(requests[1]).includes(
        'This original must not be forwarded',
      ),
    );
    assert.equal(env.ELM_API_KEY, 'teacher-test-key');
  } finally {
    globalThis.fetch = previous;
  }
});
test('incomplete text generation is rejected instead of saving partial output', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [
            { finish_reason: 'length', message: { content: 'partial' } },
          ],
        }),
      );
    await assert.rejects(processClassroomText(payload, { env }), /长度上限/);
  } finally {
    globalThis.fetch = previous;
  }
});
test('live speech proxy only accepts the local app origin', () => {
  const req = {
    headers: { host: 'localhost:5175', origin: 'http://localhost:5175' },
    socket: { remoteAddress: '127.0.0.1' },
  };
  assert(allowedClassroomOrigin(req));
  assert(
    !allowedClassroomOrigin({
      ...req,
      headers: { ...req.headers, origin: 'https://evil.example' },
    }),
  );
  assert(
    !allowedClassroomOrigin({
      ...req,
      headers: { ...req.headers, origin: undefined },
    }),
  );
  assert(
    !allowedClassroomOrigin({
      ...req,
      socket: { remoteAddress: '203.0.113.1' },
    }),
  );
  assert(
    !allowedClassroomOrigin({
      ...req,
      headers: { host: 'evil.example', origin: 'http://evil.example' },
    }),
  );
});
