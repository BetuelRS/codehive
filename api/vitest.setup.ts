// No global setup needed. DB/Redis connections are lazy — first call creates them.
// Mock tests (db.test.ts, queue.test.ts) use vi.mock() which intercepts modules.
// Integration tests skip if REDIS_HOST is not set.
