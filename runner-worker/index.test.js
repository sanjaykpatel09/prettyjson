import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.js';

const origin = 'https://sanjaykpatel09.github.io';
const env = {
  ALLOWED_ORIGINS: origin,
  JDOODLE_CLIENT_ID: 'test-client-id',
  JDOODLE_CLIENT_SECRET: 'test-client-secret',
  JAVA_VERSION_INDEX_8: '0',
  JAVA_VERSION_INDEX_11: '1',
  JAVA_VERSION_INDEX_17: '2',
  JAVA_VERSION_INDEX_22: '3',
  JAVA_RUN_LIMITER: {
    limit: async () => ({ success: true }),
  },
};

function makeRequest(path, { method = 'POST', body, requestOrigin = origin } = {}) {
  const headers = { 'CF-Connecting-IP': '192.0.2.10' };
  if (requestOrigin) headers.Origin = requestOrigin;

  return new Request(`https://runner.example${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : {
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }),
  });
}

for (const version of ['8', '11', '17', '22']) {
  test(`routes Java ${version} to its configured JDoodle version`, async (t) => {
    let upstreamBody;
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      upstreamBody = JSON.parse(options.body);
      return Response.json({ output: `Java ${version} result`, statusCode: 200 });
    });

    const response = await worker.fetch(
      makeRequest('/run', { body: { script: 'class Main {}', stdin: '', version } }),
      env,
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.output, `Java ${version} result`);
    assert.equal(upstreamBody.language, 'java');
    assert.equal(upstreamBody.versionIndex, env[`JAVA_VERSION_INDEX_${version}`]);
    assert.equal(upstreamBody.clientId, env.JDOODLE_CLIENT_ID);
    assert.equal(upstreamBody.clientSecret, env.JDOODLE_CLIENT_SECRET);
  });
}

test('rejects a disallowed origin without calling JDoodle', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    assert.fail('JDoodle must not be called for a disallowed origin.');
  });

  const response = await worker.fetch(
    makeRequest('/run', {
      body: { script: 'class Main {}', stdin: '', version: '8' },
      requestOrigin: 'https://attacker.example',
    }),
    env,
  );

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});

test('answers CORS preflight for an allowed site', async () => {
  const response = await worker.fetch(makeRequest('/run', { method: 'OPTIONS' }), env);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), origin);
  assert.match(response.headers.get('Access-Control-Allow-Methods'), /POST/u);
});

test('rejects unsupported Java versions without calling JDoodle', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    assert.fail('JDoodle must not be called for an unsupported Java version.');
  });

  const response = await worker.fetch(
    makeRequest('/run', { body: { script: 'class Main {}', stdin: '', version: '26' } }),
    env,
  );

  assert.equal(response.status, 400);
});

test('reports an unconfigured version index without calling JDoodle', async (t) => {
  const partialEnv = { ...env, JAVA_VERSION_INDEX_8: undefined };
  t.mock.method(globalThis, 'fetch', async () => {
    assert.fail('JDoodle must not be called without a configured version index.');
  });

  const response = await worker.fetch(
    makeRequest('/run', { body: { script: 'class Main {}', stdin: '', version: '8' } }),
    partialEnv,
  );
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.match(body.error, /Java 8/u);
});

test('rejects oversized source code', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    assert.fail('JDoodle must not be called for oversized source code.');
  });

  const response = await worker.fetch(
    makeRequest('/run', { body: { script: 'x'.repeat(50_001), stdin: '', version: '8' } }),
    env,
  );

  assert.equal(response.status, 413);
});

test('rejects runs when the per-IP rate limit is reached', async (t) => {
  const limitedEnv = {
    ...env,
    JAVA_RUN_LIMITER: { limit: async () => ({ success: false }) },
  };
  t.mock.method(globalThis, 'fetch', async () => {
    assert.fail('JDoodle must not be called for a rate-limited request.');
  });

  const response = await worker.fetch(
    makeRequest('/run', { body: { script: 'class Main {}', stdin: '', version: '8' } }),
    limitedEnv,
  );

  assert.equal(response.status, 429);
});
