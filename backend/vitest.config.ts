import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      bindings: {
        ANTHROPIC_API_KEY: 'test-api-key',
        ENVIRONMENT: 'test'
      },
      kvNamespaces: ['TEST_NAMESPACE'],
      durableObjects: {},
      r2Buckets: ['TEST_BUCKET'],
      d1Databases: ['TEST_DB']
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        '**/__tests__/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});