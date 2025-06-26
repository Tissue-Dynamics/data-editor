import { describe, test, expect, vi, beforeEach } from 'vitest';
import { TaskService } from '../tasks';
import type { D1Database } from '@cloudflare/workers-types';

// Mock D1 Database
const mockDb = {
  prepare: vi.fn(() => ({
    bind: vi.fn(() => ({
      run: vi.fn(),
      first: vi.fn(),
      all: vi.fn(() => ({ results: [] }))
    })),
    run: vi.fn(),
    first: vi.fn(),
    all: vi.fn(() => ({ results: [] }))
  })),
  batch: vi.fn()
} as unknown as D1Database;

describe('TaskService Edge Cases', () => {
  let taskService: TaskService;

  beforeEach(() => {
    taskService = new TaskService(mockDb);
    vi.clearAllMocks();
  });

  describe('Running Tasks Edge Cases', () => {
    test('should handle task events when user navigates away and returns', async () => {
      const taskId = 'test-task-123';
      const existingEvents = [
        {
          id: 'event-1',
          type: 'analysis',
          description: 'Starting analysis',
          status: 'completed',
          timestamp: new Date().toISOString()
        },
        {
          id: 'event-2',
          type: 'search',
          description: 'Searching web',
          status: 'running',
          timestamp: new Date().toISOString()
        }
      ];

      // Mock existing task with events
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => ({
            id: taskId,
            status: 'processing',
            events: JSON.stringify(existingEvents)
          }))
        }))
      })) as any;

      const task = await taskService.getTask(taskId);
      expect(task).toBeTruthy();
      expect(task?.events).toBe(JSON.stringify(existingEvents));
    });

    test('should handle adding events to a task with no previous events', async () => {
      const taskId = 'test-task-no-events';
      
      // Mock task with no events
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => ({
            id: taskId,
            status: 'processing',
            events: null
          })),
          run: vi.fn()
        }))
      })) as any;

      await taskService.addTaskEvent(taskId, {
        type: 'analysis',
        description: 'First event',
        status: 'running'
      });

      // Verify the update was called with a new event array
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE tasks SET events = ?')
      );
    });
  });

  describe('Orphaned Tasks', () => {
    test('should identify tasks stuck in processing state', async () => {
      const stuckTasks = [
        {
          id: 'stuck-1',
          status: 'processing',
          created_at: Date.now() - 3600000, // 1 hour ago
          events: JSON.stringify([{
            type: 'analysis',
            status: 'running',
            timestamp: new Date(Date.now() - 3600000).toISOString()
          }])
        },
        {
          id: 'stuck-2',
          status: 'processing',
          created_at: Date.now() - 7200000, // 2 hours ago
          events: null
        }
      ];

      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(() => ({ results: stuckTasks }))
        }))
      })) as any;

      // This would be a new method to add
      const tasks = await taskService.getPendingTasks(10);
      
      // Tasks older than 30 minutes in processing state should be considered stuck
      const stuckTasksFound = tasks.filter(t => 
        t.status === 'processing' && 
        Date.now() - t.created_at > 1800000 // 30 minutes
      );

      expect(stuckTasksFound.length).toBe(2);
    });
  });

  describe('Race Conditions', () => {
    test('should handle simultaneous status updates', async () => {
      const taskId = 'race-condition-task';
      let callCount = 0;

      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          run: vi.fn(() => {
            callCount++;
            if (callCount === 1) {
              // Simulate concurrent update
              return Promise.resolve();
            }
            throw new Error('SQLITE_BUSY: database is locked');
          })
        }))
      })) as any;

      // First update should succeed
      await taskService.updateTask(taskId, { status: 'completed' });
      
      // Second concurrent update should fail
      await expect(
        taskService.updateTask(taskId, { status: 'failed' })
      ).rejects.toThrow('database is locked');
    });
  });

  describe('Multiple Browser Tabs', () => {
    test('should handle events from multiple sources', async () => {
      const taskId = 'multi-tab-task';
      const existingEvents = [
        { id: '1', type: 'analysis', status: 'completed' }
      ];

      // First tab adds an event
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => ({
            id: taskId,
            events: JSON.stringify(existingEvents)
          })),
          run: vi.fn()
        }))
      })) as any;

      await taskService.addTaskEvent(taskId, {
        type: 'search',
        description: 'From tab 1',
        status: 'running'
      });

      // Verify events are appended, not replaced
      const bindCall = (mockDb.prepare as any).mock.results[1].value.bind.mock.calls[0];
      const updatedEvents = JSON.parse(bindCall[0]);
      
      expect(updatedEvents.length).toBe(2);
      expect(updatedEvents[0].id).toBe('1');
      expect(updatedEvents[1].description).toBe('From tab 1');
    });
  });

  describe('Server Restart', () => {
    test('should recover task state from database after restart', async () => {
      const runningTasks = [
        {
          id: 'task-1',
          status: 'processing',
          events: JSON.stringify([
            { type: 'analysis', status: 'running' }
          ])
        },
        {
          id: 'task-2',
          status: 'pending',
          events: null
        }
      ];

      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(() => ({ results: runningTasks }))
        }))
      })) as any;

      // After restart, should be able to query incomplete tasks
      const incompleteTasks = await taskService.getPendingTasks(100);
      
      expect(incompleteTasks.length).toBe(2);
      expect(incompleteTasks[0].status).toBe('processing');
      expect(incompleteTasks[1].status).toBe('pending');
    });
  });

  describe('Error Handling', () => {
    test('should gracefully handle database errors when saving events', async () => {
      const taskId = 'error-task';
      
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => {
            throw new Error('D1_ERROR: Connection lost');
          })
        }))
      })) as any;

      // Should not throw, but task won't be found
      await taskService.addTaskEvent(taskId, {
        type: 'analysis',
        description: 'This will fail',
        status: 'running'
      });

      // The method returns early if task not found
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    test('should handle malformed events JSON', async () => {
      const taskId = 'malformed-events-task';
      
      mockDb.prepare = vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => ({
            id: taskId,
            status: 'processing',
            events: '{invalid json'
          }))
        }))
      })) as any;

      const task = await taskService.getTask(taskId);
      
      // Should return task but with invalid events field
      expect(task).toBeTruthy();
      expect(() => JSON.parse(task!.events || '[]')).toThrow();
    });
  });
});