// Test setup file for Vitest
import { vi } from 'vitest';

// Global test environment setup
global.console = {
  ...global.console,
  log: vi.fn(), // Mock console.log in tests
  error: vi.fn(), // Mock console.error in tests
  warn: vi.fn(), // Mock console.warn in tests
};

// Setup fetch mock for API calls
global.fetch = vi.fn();

// Mock performance for timing tests
global.performance = {
  ...global.performance,
  now: vi.fn(() => Date.now()),
};

// Mock Request and Response for Hono testing
global.Request = class extends Request {};
global.Response = class extends Response {};

export {};