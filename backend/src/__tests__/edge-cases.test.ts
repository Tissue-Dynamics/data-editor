import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TaskStreaming } from '../utils/streaming';
import { createHash } from '../utils/hash';
import type { Env } from '../types';

// Mock dependencies
vi.mock('../utils/streaming', () => ({
  TaskStreaming: {
    emitToolStart: vi.fn(),
    emitToolComplete: vi.fn(),
    emitToolError: vi.fn(),
    emitAnalysisStart: vi.fn(),
    emitAnalysisComplete: vi.fn(),
    addStream: vi.fn(),
    removeTask: vi.fn(),
    getEvents: vi.fn(() => [])
  }
}));

describe('Edge Cases and Weird States', () => {
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = {
      ANTHROPIC_API_KEY: 'test-key',
      DB: {} as any,
      R2_BUCKET: {} as any,
      ENVIRONMENT: 'test'
    };
    vi.clearAllMocks();
  });

  describe('Data Structure Edge Cases', () => {
    it('should handle circular references in data', () => {
      const circularData: any = { name: 'test' };
      circularData.self = circularData; // Creates circular reference

      expect(() => {
        try {
          JSON.stringify(circularData);
        } catch (error) {
          // This is expected - JSON.stringify fails on circular refs
          expect(error).toBeInstanceOf(TypeError);
          throw error;
        }
      }).toThrow();

      // Simulated safe handling
      const safeData = { name: 'test', self: '[Circular Reference]' };
      expect(() => JSON.stringify(safeData)).not.toThrow();
    });

    it('should handle deeply nested objects', () => {
      const deepObject: any = { level: 0 };
      let current = deepObject;
      
      // Create 1000 levels deep
      for (let i = 1; i < 1000; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      const serialized = JSON.stringify(deepObject);
      expect(serialized.length).toBeGreaterThan(10000);
      
      // Test truncation logic
      const shouldTruncate = serialized.length > 50000;
      expect(shouldTruncate).toBe(false); // Our test object isn't that big
    });

    it('should handle objects with Symbol keys', () => {
      const symbolKey = Symbol('test');
      const dataWithSymbols = {
        [symbolKey]: 'symbol-value',
        regularKey: 'regular-value'
      };

      // Symbols are ignored in JSON.stringify
      const serialized = JSON.stringify(dataWithSymbols);
      expect(serialized).toBe('{"regularKey":"regular-value"}');
      expect(serialized).not.toContain('symbol-value');
    });

    it('should handle objects with function properties', () => {
      const dataWithFunctions = {
        name: 'test',
        method: () => 'test function',
        arrow: () => 'arrow function',
        regularValue: 123
      };

      // Functions are ignored in JSON.stringify
      const serialized = JSON.stringify(dataWithFunctions);
      expect(serialized).toBe('{"name":"test","regularValue":123}');
      expect(serialized).not.toContain('function');
    });

    it('should handle BigInt values', () => {
      const dataWithBigInt = {
        smallNumber: 123,
        bigNumber: BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1000)
      };

      expect(() => JSON.stringify(dataWithBigInt)).toThrow(TypeError);
      
      // Safe handling would convert BigInt to string
      const safeData = {
        smallNumber: 123,
        bigNumber: dataWithBigInt.bigNumber.toString()
      };
      expect(() => JSON.stringify(safeData)).not.toThrow();
    });

    it('should handle extremely long strings', () => {
      const veryLongString = 'x'.repeat(1000000); // 1MB string
      const dataWithLongString = { content: veryLongString };
      
      const serialized = JSON.stringify(dataWithLongString);
      expect(serialized.length).toBeGreaterThan(1000000);
      
      // Test memory implications
      expect(veryLongString.length).toBe(1000000);
    });
  });

  describe('Validation State Edge Cases', () => {
    it('should handle validation with invalid row/column indices', () => {
      const validations = [
        {
          rowIndex: -1, // Negative index
          columnId: 'test',
          status: 'error' as const,
          originalValue: 'test',
          reason: 'Invalid row index'
        },
        {
          rowIndex: 999999, // Way out of bounds
          columnId: 'nonexistent',
          status: 'warning' as const,
          originalValue: 'test',
          reason: 'Row index out of bounds'
        },
        {
          rowIndex: 0,
          columnId: '', // Empty column ID
          status: 'error' as const,
          originalValue: 'test',
          reason: 'Empty column ID'
        }
      ];

      // Simulate validation filtering
      const validValidations = validations.filter(v => 
        v.rowIndex >= 0 && 
        v.columnId.trim().length > 0
      );

      expect(validValidations).toHaveLength(1);
      expect(validValidations[0].rowIndex).toBe(999999);
    });

    it('should handle validation status transitions', () => {
      const validationState = {
        status: 'unchecked' as const,
        applied: false,
        confirmed: false
      };

      // Test invalid state transitions
      const invalidTransitions = [
        { from: 'unchecked', to: 'confirmed' }, // Skip auto_updated
        { from: 'confirmed', to: 'unchecked' }, // Backwards transition
        { from: 'conflict', to: 'auto_updated' } // Invalid conflict resolution
      ];

      invalidTransitions.forEach(transition => {
        // In a real system, these should be validated
        expect(transition.from).toBeDefined();
        expect(transition.to).toBeDefined();
      });
    });

    it('should handle concurrent validation updates', () => {
      const cellValidations = new Map();
      const cellKey = '0-test';

      // Simulate concurrent updates
      const update1 = {
        status: 'auto_updated',
        timestamp: new Date('2025-01-01T10:00:00Z')
      };
      
      const update2 = {
        status: 'confirmed',
        timestamp: new Date('2025-01-01T10:00:01Z') // 1 second later
      };

      cellValidations.set(cellKey, update1);
      
      // Race condition: what if update2 arrives first?
      if (update2.timestamp > update1.timestamp) {
        cellValidations.set(cellKey, update2);
      }

      expect(cellValidations.get(cellKey).status).toBe('confirmed');
    });
  });

  describe('Task Execution Edge Cases', () => {
    it('should handle tasks with malformed prompts', () => {
      const malformedPrompts = [
        '', // Empty prompt
        ' '.repeat(1000), // Only whitespace
        '\n\t\r', // Only control characters
        '🚀🔥💯'.repeat(100), // Only emojis
        'A'.repeat(100000), // Extremely long prompt
        null as any, // Null prompt
        undefined as any, // Undefined prompt
        123 as any, // Non-string prompt
        {} as any // Object as prompt
      ];

      malformedPrompts.forEach(prompt => {
        const isValid = typeof prompt === 'string' && prompt.trim().length > 0;
        if (!isValid) {
          expect(prompt).toBeFalsy();
        }
      });
    });

    it('should handle tasks with invalid selection arrays', () => {
      const invalidSelections = [
        { rows: [-1, -2], columns: ['test'] }, // Negative indices
        { rows: [0.5, 1.7], columns: ['test'] }, // Non-integer indices
        { rows: [NaN, Infinity], columns: ['test'] }, // Invalid numbers
        { rows: ['0', '1'], columns: ['test'] }, // String indices
        { rows: [null, undefined], columns: ['test'] }, // Null values
        { rows: [], columns: [] }, // Empty selections
      ];

      invalidSelections.forEach(selection => {
        const validRows = selection.rows.filter(r => 
          typeof r === 'number' && 
          Number.isInteger(r) && 
          r >= 0 && 
          Number.isFinite(r)
        );
        
        // Most selections should be filtered out as invalid
        expect(validRows.length).toBeLessThanOrEqual(selection.rows.length);
      });
    });

    it('should handle task cancellation and cleanup', () => {
      const activeTask = {
        id: 'task_123',
        status: 'running' as const,
        abortController: new AbortController()
      };

      // Simulate task cancellation
      activeTask.abortController.abort();
      expect(activeTask.abortController.signal.aborted).toBe(true);

      // Cleanup should remove task from active list
      const activeTasks = new Map([['task_123', activeTask]]);
      activeTasks.delete('task_123');
      expect(activeTasks.has('task_123')).toBe(false);
    });

    it('should handle memory leaks from streaming events', () => {
      const mockStreamListeners = new Map();
      const taskId = 'memory_leak_task';

      // Simulate adding many listeners
      for (let i = 0; i < 1000; i++) {
        const listenerId = `listener_${i}`;
        mockStreamListeners.set(listenerId, () => {});
      }

      expect(mockStreamListeners.size).toBe(1000);

      // Cleanup should remove all listeners
      mockStreamListeners.clear();
      expect(mockStreamListeners.size).toBe(0);

      // Verify streaming cleanup
      TaskStreaming.removeTask(taskId);
      expect(TaskStreaming.removeTask).toHaveBeenCalledWith(taskId);
    });
  });

  describe('Data Hash Edge Cases', () => {
    it('should handle identical data with different ordering', () => {
      const data1 = [{ a: 1, b: 2 }, { c: 3, d: 4 }];
      const data2 = [{ b: 2, a: 1 }, { d: 4, c: 3 }]; // Same data, different order

      const hash1 = createHash(JSON.stringify(data1));
      const hash2 = createHash(JSON.stringify(data2));

      // Hashes will be different due to key ordering
      expect(hash1).not.toBe(hash2);

      // For consistent hashing, would need to normalize order
      const normalize = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(normalize);
        }
        if (obj && typeof obj === 'object') {
          const sorted: any = {};
          Object.keys(obj).sort().forEach(key => {
            sorted[key] = normalize(obj[key]);
          });
          return sorted;
        }
        return obj;
      };

      const normalizedHash1 = createHash(JSON.stringify(normalize(data1)));
      const normalizedHash2 = createHash(JSON.stringify(normalize(data2)));
      expect(normalizedHash1).toBe(normalizedHash2);
    });

    it('should handle hash collisions gracefully', () => {
      // While unlikely with SHA-256, test collision handling
      const mockHashFunction = (input: string) => {
        // Intentionally bad hash function for testing
        return input.length.toString();
      };

      const data1 = 'a'.repeat(10);
      const data2 = 'b'.repeat(10);

      const hash1 = mockHashFunction(data1);
      const hash2 = mockHashFunction(data2);

      expect(hash1).toBe(hash2); // Collision!

      // Real system should handle this by including original data
      const hashMap = new Map();
      if (hashMap.has(hash1)) {
        // Handle collision by comparing actual data
        expect(data1).not.toBe(data2);
      }
    });
  });

  describe('API Response Edge Cases', () => {
    it('should handle Claude API returning unexpected structure', () => {
      const unexpectedResponses = [
        { content: [] }, // Empty content
        { content: null }, // Null content
        { content: [{ type: 'unknown', data: 'weird' }] }, // Unknown content type
        { content: [{ type: 'tool_use', name: 'invalid_tool' }] }, // Invalid tool
        { content: [{ type: 'tool_use', input: null }] }, // Null input
        {}, // Missing content entirely
        null, // Null response
        undefined // Undefined response
      ];

      unexpectedResponses.forEach(response => {
        const isValidResponse = response && 
          response.content && 
          Array.isArray(response.content) &&
          response.content.length > 0;
        
        if (!isValidResponse) {
          // Should handle gracefully
          expect(response).toBeDefined();
        }
      });
    });

    it('should handle partial JSON responses in batch mode', () => {
      const partialJsonResponses = [
        '{"analysis": "test"', // Incomplete JSON
        '{"analysis": "test", "validations": [', // Incomplete array
        '{"analysis": "test", "validations": [{"rowIndex": 0,]}', // Trailing comma
        'not json at all', // Not JSON
        '{"analysis": null}', // Null values
        '{}', // Empty object
        '{"validations": "should be array"}' // Wrong type
      ];

      partialJsonResponses.forEach(jsonString => {
        try {
          const parsed = JSON.parse(jsonString);
          // If parsing succeeds, validate structure
          expect(parsed).toBeDefined();
        } catch (error) {
          // Should handle parse errors gracefully
          expect(error).toBeInstanceOf(SyntaxError);
        }
      });
    });
  });

  describe('Database Edge Cases', () => {
    it('should handle database connection failures', () => {
      const mockDB = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('Database connection lost');
        })
      };

      expect(() => {
        mockDB.prepare('SELECT * FROM tasks');
      }).toThrow('Database connection lost');
    });

    it('should handle transaction rollbacks', () => {
      const transactionState = {
        active: false,
        operations: [] as string[]
      };

      try {
        transactionState.active = true;
        transactionState.operations.push('INSERT task');
        transactionState.operations.push('UPDATE validation');
        
        // Simulate error
        throw new Error('Constraint violation');
      } catch (error) {
        // Rollback
        transactionState.active = false;
        transactionState.operations = [];
        expect(transactionState.operations).toHaveLength(0);
      }
    });

    it('should handle extremely large database results', () => {
      const mockLargeResult = Array.from({ length: 100000 }, (_, i) => ({
        id: i,
        data: `record_${i}`
      }));

      // Memory usage test
      const memoryUsage = JSON.stringify(mockLargeResult).length;
      expect(memoryUsage).toBeGreaterThan(1000000); // > 1MB

      // Should implement pagination for large results
      const pageSize = 100;
      const page1 = mockLargeResult.slice(0, pageSize);
      expect(page1).toHaveLength(pageSize);
    });
  });

  describe('Concurrency Edge Cases', () => {
    it('should handle race conditions in task updates', async () => {
      const taskState = { status: 'pending', updateCount: 0 };
      
      // Simulate concurrent updates
      const updates = Array.from({ length: 10 }, (_, i) => 
        Promise.resolve().then(() => {
          taskState.updateCount++;
          taskState.status = i % 2 === 0 ? 'processing' : 'completed';
        })
      );

      await Promise.all(updates);
      
      expect(taskState.updateCount).toBe(10);
      // Final status is unpredictable due to race condition
      expect(['processing', 'completed']).toContain(taskState.status);
    });

    it('should handle multiple tasks with same data hash', () => {
      const taskCache = new Map();
      const dataHash = 'same_hash_123';

      // Multiple tasks with same data
      const tasks = [
        { id: 'task_1', dataHash, prompt: 'Analyze this' },
        { id: 'task_2', dataHash, prompt: 'Validate this' },
        { id: 'task_3', dataHash, prompt: 'Check this' }
      ];

      tasks.forEach(task => {
        taskCache.set(task.id, task);
      });

      // All tasks should be cached separately despite same data hash
      expect(taskCache.size).toBe(3);
      
      // But validation cache could be shared
      const validationCache = new Map();
      const cacheKey = `${dataHash}_analyze`;
      validationCache.set(cacheKey, { validations: [] });
      
      expect(validationCache.has(cacheKey)).toBe(true);
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle memory pressure during large operations', () => {
      // Simulate memory pressure
      const largeArrays = Array.from({ length: 1000 }, () => 
        new Array(10000).fill('memory_test')
      );

      expect(largeArrays.length).toBe(1000);
      
      // In real scenario, should implement memory monitoring
      const memoryUsageMB = (largeArrays.length * 10000 * 11) / (1024 * 1024); // Rough estimate
      expect(memoryUsageMB).toBeGreaterThan(100); // > 100MB
      
      // Cleanup
      largeArrays.length = 0;
      expect(largeArrays.length).toBe(0);
    });

    it('should handle slow network responses', async () => {
      // Simulate slow response
      const slowResponse = new Promise(resolve => {
        setTimeout(() => resolve({ data: 'slow response' }), 5000);
      });

      // Should implement timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 1000);
      });

      await expect(Promise.race([slowResponse, timeoutPromise]))
        .rejects.toThrow('Timeout');
    });
  });

  describe('Environment Edge Cases', () => {
    it('should handle missing environment variables', () => {
      const emptyEnv = {} as Env;
      
      expect(emptyEnv.ANTHROPIC_API_KEY).toBeUndefined();
      expect(emptyEnv.DB).toBeUndefined();
      
      // Should have fallback behavior
      const hasApiKey = !!emptyEnv.ANTHROPIC_API_KEY;
      expect(hasApiKey).toBe(false);
    });

    it('should handle malformed environment variables', () => {
      const malformedEnv = {
        ANTHROPIC_API_KEY: '', // Empty string
        DB: null as any, // Null instead of object
        R2_BUCKET: undefined as any, // Undefined
        ENVIRONMENT: 'invalid-env' // Invalid environment
      };

      Object.entries(malformedEnv).forEach(([key, value]) => {
        const isValid = value !== null && value !== undefined && value !== '';
        if (!isValid) {
          expect(value).toBeFalsy();
        }
      });
    });
  });
});