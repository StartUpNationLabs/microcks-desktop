import http from 'node:http';

export function waitForHttp(url: string, timeoutMs = 90_000, intervalMs = 1000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          res.resume();
          return resolve();
        }
        res.resume();
        next();
      });
      req.on('error', next);
      req.setTimeout(1000, () => req.destroy(new Error('timeout')));
    };
    const next = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}
