import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

test('local HTTP serves the application and source PDFs without exposing project files', async () => {
  process.env.PORT = '0';
  const { server } = await import('../server.mjs');
  if (!server.listening) await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of ['/', '/app.js', '/styles.css', '/assignments.json', '/lib.js', '/icon.svg']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200, route);
      assert.ok(response.headers.get('content-security-policy'));
      await response.arrayBuffer();
    }
    const pdf = await fetch(base + '/data/5-Daily%20Blessings-26-27.pdf');
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers.get('content-type'), 'application/pdf');
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
    const metadata = await fetch(base + '/assignments.json', { method: 'HEAD' });
    assert.equal(metadata.status, 200);
    assert.equal((await metadata.text()).length, 0);
    for (const route of ['/package.json', '/scripts/extract_assignments.py', '/%2e%2e%2fserver.mjs', '/data/../server.mjs']) {
      const response = await fetch(base + route);
      assert.ok(response.status === 403 || response.status === 404);
    }
    const post = await fetch(base + '/', { method: 'POST', body: 'test' });
    assert.equal(post.status, 405);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
