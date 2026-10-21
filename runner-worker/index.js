const MAX_REQUEST_BYTES = 100_000;
const MAX_SCRIPT_LENGTH = 50_000;
const MAX_STDIN_LENGTH = 20_000;
const JAVA_VERSIONS = new Set(['8', '11', '17', '22']);

function jsonResponse(body, status, origin) {
  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
  };

  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }

  return new Response(JSON.stringify(body), { status, headers });
}

function getAllowedOrigins(env) {
  return (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    const origin = request.headers.get('Origin');
    const isAllowedOrigin = origin !== null && getAllowedOrigins(env).includes(origin);

    if (!isAllowedOrigin) {
      return jsonResponse({ error: 'This website is not allowed to use the Java runner.' }, 403);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        },
      });
    }

    if (requestUrl.pathname !== '/run') {
      return jsonResponse({ error: 'Endpoint not found.' }, 404, origin);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Use POST to run Java code.' }, 405, origin);
    }

    const contentLength = Number(request.headers.get('Content-Length') ?? 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ error: 'The request is too large.' }, 413, origin);
    }

    let rawBody;
    try {
      rawBody = await request.text();
    } catch {
      return jsonResponse({ error: 'Could not read the request body.' }, 400, origin);
    }

    if (new TextEncoder().encode(rawBody).length > MAX_REQUEST_BYTES) {
      return jsonResponse({ error: 'The request is too large.' }, 413, origin);
    }

    let input;
    try {
      input = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: 'Request body must be valid JSON.' }, 400, origin);
    }

    if (
      input === null
      || typeof input !== 'object'
      || Array.isArray(input)
      || typeof input.script !== 'string'
      || typeof input.stdin !== 'string'
      || typeof input.version !== 'string'
    ) {
      return jsonResponse({ error: 'Provide source code, standard input, and a Java version as text.' }, 400, origin);
    }

    if (!JAVA_VERSIONS.has(input.version)) {
      return jsonResponse({ error: 'Choose Java 8, 11, 17, or 22.' }, 400, origin);
    }

    if (input.script.length === 0 || input.script.length > MAX_SCRIPT_LENGTH) {
      return jsonResponse({ error: 'Source code must be between 1 and 50,000 characters.' }, 413, origin);
    }

    if (input.stdin.length > MAX_STDIN_LENGTH) {
      return jsonResponse({ error: 'Standard input must be at most 20,000 characters.' }, 413, origin);
    }

    const clientIp = request.headers.get('CF-Connecting-IP');
    if (!clientIp) {
      return jsonResponse({ error: 'Could not identify the request for rate limiting.' }, 503, origin);
    }

    if (!env.JAVA_RUN_LIMITER) {
      return jsonResponse({ error: 'The Java runner rate limiter is not configured.' }, 503, origin);
    }

    let isWithinRateLimit;
    try {
      ({ success: isWithinRateLimit } = await env.JAVA_RUN_LIMITER.limit({ key: clientIp }));
    } catch {
      return jsonResponse({ error: 'Could not check the Java runner rate limit.' }, 503, origin);
    }
    if (!isWithinRateLimit) {
      return jsonResponse({ error: 'Java runner rate limit reached. Wait a minute and try again.' }, 429, origin);
    }

    if (!env.JDOODLE_CLIENT_ID || !env.JDOODLE_CLIENT_SECRET) {
      return jsonResponse({ error: 'The Java runner is missing its server-side credentials.' }, 503, origin);
    }

    const versionIndex = env[`JAVA_VERSION_INDEX_${input.version}`];
    if (!/^\d+$/u.test(versionIndex ?? '')) {
      return jsonResponse({ error: `The JDoodle version index for Java ${input.version} is not configured.` }, 503, origin);
    }

    let upstreamResponse;
    try {
      upstreamResponse = await fetch('https://api.jdoodle.com/v1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: env.JDOODLE_CLIENT_ID,
          clientSecret: env.JDOODLE_CLIENT_SECRET,
          script: input.script,
          language: 'java',
          versionIndex,
          stdin: input.stdin,
        }),
        signal: request.signal,
      });
    } catch {
      return jsonResponse({ error: 'Could not connect to the Java execution service.' }, 502, origin);
    }

    let result;
    try {
      result = await upstreamResponse.json();
    } catch {
      return jsonResponse({ error: 'The Java execution service returned an invalid response.' }, 502, origin);
    }

    if (result === null || typeof result !== 'object' || Array.isArray(result)) {
      return jsonResponse({ error: 'The Java execution service returned an invalid response.' }, 502, origin);
    }

    if (!upstreamResponse.ok || result.error) {
      return jsonResponse({
        error: typeof result.error === 'string'
          ? result.error.slice(0, 300)
          : 'The Java execution service could not run this program.',
      }, upstreamResponse.status === 429 ? 429 : 502, origin);
    }

    if (typeof result.output !== 'string') {
      return jsonResponse({ error: 'The Java execution service did not return a completed program result.' }, 502, origin);
    }

    return jsonResponse({ output: result.output }, 200, origin);
  },
};
