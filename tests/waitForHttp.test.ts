import http from 'node:http';
import { describe, it, expect } from 'vitest';
import { waitForHttp } from '../shared/waitForHttp';

describe('waitForHttp', () => {
  it('resolves when server returns 200', async () => {
    const server = http.createServer((_, res) => {
      res.writeHead(200);
      res.end('ok');
    });
    await new Promise<void>(resolve => server.listen(0, resolve));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    await waitForHttp(`http://localhost:${port}`, 2000, 50);
    server.close();
    expect(true).toBe(true);
  });
});
