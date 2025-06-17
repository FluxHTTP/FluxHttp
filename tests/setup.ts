// Global test setup
import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Mock timers for testing timeouts
beforeAll(() => {
  // Setup any global test utilities
});

afterAll(() => {
  // Cleanup after all tests
});

afterEach(() => {
  // Clear all mocks after each test
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  vi.clearAllMocks();
});
