export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (path === '/api/backup/health') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: jsonHeaders(),
      });
    }

    if (!authenticate(request, env)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: jsonHeaders(),
      });
    }

    if (path === '/api/backup/upload' && request.method === 'POST') {
      return handleUpload(request, env);
    }

    if (path === '/api/backup/download' && request.method === 'GET') {
      return handleDownload(url, env);
    }

    if (path === '/api/backup/list' && request.method === 'GET') {
      return handleList(env);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: jsonHeaders(),
    });
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Backup-Key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonHeaders() {
  return {
    'Content-Type': 'application/json',
    ...corsHeaders(),
  };
}

function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token || !env.BACKUP_AUTH_TOKEN) {
    return false;
  }

  return timingSafeEqual(token, env.BACKUP_AUTH_TOKEN);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function handleUpload(request, env) {
  const key = request.headers.get('X-Backup-Key');
  if (!key || !key.startsWith('backups/')) {
    return new Response(JSON.stringify({ error: 'Invalid backup key' }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  if (key.includes('..')) {
    return new Response(JSON.stringify({ error: 'Invalid backup key' }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return new Response(JSON.stringify({ error: 'Empty body' }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  await env.R2_BUCKET.put(key, body, {
    httpMetadata: {
      contentType: 'application/octet-stream',
    },
  });

  return new Response(
    JSON.stringify({ key, size: body.byteLength }),
    { status: 200, headers: jsonHeaders() },
  );
}

async function handleDownload(url, env) {
  const key = url.searchParams.get('key');
  if (!key) {
    return new Response(JSON.stringify({ error: 'Missing key parameter' }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }

  const object = await env.R2_BUCKET.get(key);
  if (!object) {
    return new Response(JSON.stringify({ error: 'Backup not found' }), {
      status: 404,
      headers: jsonHeaders(),
    });
  }

  const headers = new Headers(jsonHeaders());
  headers.set('Content-Type', 'application/octet-stream');
  headers.set('Content-Length', String(object.size));

  return new Response(object.body, { status: 200, headers });
}

async function handleList(env) {
  const listed = await env.R2_BUCKET.list({ prefix: 'backups/' });

  const backups = listed.objects
    .filter((obj) => obj.key.endsWith('.enc'))
    .map((obj) => ({
      key: obj.key,
      size: obj.size,
      lastModified: obj.uploaded.toISOString(),
    }))
    .sort((a, b) => b.lastModified.localeCompare(a.lastModified));

  return new Response(JSON.stringify({ backups }), {
    status: 200,
    headers: jsonHeaders(),
  });
}
