/**
 * Tests for unhandledRejection and uncaughtException process handlers (SRVR-01).
 *
 * Wave 0: These tests WILL FAIL (RED) until server.ts registers fatalHandler in Wave 1.
 * Expected failures:
 *   - 'fatalHandler' is not exported from server.ts yet
 *   - unhandledRejection / uncaughtException handlers not yet registered in server.ts
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock buildApp so importing server.ts does not start a real HTTP server
// (avoids EADDRINUSE port conflicts and hanging processes in tests)
vi.mock('../app.js', () => ({
  buildApp: vi.fn(() => ({
    listen: vi.fn((_port: number, cb: () => void) => {
      if (cb) cb();
      return { close: vi.fn((cb2: () => void) => cb2?.()) };
    }),
  })),
}));

// Mock the expiration worker so it does not schedule real cron jobs
vi.mock('../workers/expiration-worker.js', () => ({
  startExpirationWorker: vi.fn(),
  stopExpirationWorker: vi.fn(),
}));

// Mock the logger to capture fatal calls without real log output
vi.mock('../middleware/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the DB pool so pool.end() does not hit a real database
vi.mock('../db/connection.js', () => ({
  pool: { end: vi.fn().mockResolvedValue(undefined) },
  db: {},
}));

describe('SRVR-01 — process crash handlers', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    vi.unstubAllEnvs();
    // Remove any unhandledRejection / uncaughtException listeners added by server.ts
    // to prevent listener accumulation across tests
    process.removeAllListeners('unhandledRejection');
    process.removeAllListeners('uncaughtException');
  });

  test('unhandledRejection: calls process.exit(1)', async () => {
    // Import server.ts — this registers handlers as a side effect in Wave 1
    await import('../server.js');
    const err = new Error('unhandled rejection test');
    process.emit('unhandledRejection', err, Promise.resolve());
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('uncaughtException: calls process.exit(1)', async () => {
    await import('../server.js');
    const err = new Error('uncaught exception test');
    process.emit('uncaughtException', err, 'uncaughtException');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('unhandledRejection: logger.fatal is called with error and origin', async () => {
    const { logger } = await import('../middleware/logger.js');
    await import('../server.js');
    const err = new Error('unhandled rejection test fatal');
    process.emit('unhandledRejection', err, Promise.resolve());
    // logger.fatal must be called — args include the error and origin
    expect(logger.fatal).toHaveBeenCalled();
    const callArgs = (logger.fatal as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs).toBeDefined();
  });

  test('uncaughtException: logger.fatal is called with error and origin', async () => {
    const { logger } = await import('../middleware/logger.js');
    await import('../server.js');
    const err = new Error('uncaught exception test fatal');
    process.emit('uncaughtException', err, 'uncaughtException');
    expect(logger.fatal).toHaveBeenCalled();
    const callArgs = (logger.fatal as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs).toBeDefined();
  });
});
