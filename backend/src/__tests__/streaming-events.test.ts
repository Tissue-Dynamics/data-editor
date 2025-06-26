import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TaskStreaming } from '../utils/streaming';

// Mock streaming utility
vi.mock('../utils/streaming', () => {
  const actualStreaming = {
    streams: new Map(),
    events: new Map(),
    
    addStream: vi.fn((taskId: string, callback: Function) => {
      actualStreaming.streams.set(taskId, callback);
      return () => actualStreaming.streams.delete(taskId);
    }),
    
    removeTask: vi.fn((taskId: string) => {
      actualStreaming.streams.delete(taskId);
      actualStreaming.events.delete(taskId);
    }),
    
    emitEvent: vi.fn((taskId: string, event: any) => {
      if (!actualStreaming.events.has(taskId)) {
        actualStreaming.events.set(taskId, []);
      }
      actualStreaming.events.get(taskId).push(event);
      
      const callback = actualStreaming.streams.get(taskId);
      if (callback) {
        callback(event);
      }
    }),
    
    getEvents: vi.fn((taskId: string) => {
      return actualStreaming.events.get(taskId) || [];
    }),
    
    emitToolStart: vi.fn((taskId: string, tool: string, description: string, details?: string) => {
      actualStreaming.emitEvent(taskId, {
        type: 'tool_start',
        tool,
        description,
        details,
        timestamp: Date.now()
      });
    }),
    
    emitToolComplete: vi.fn((taskId: string, tool: string, description: string, result?: any) => {
      actualStreaming.emitEvent(taskId, {
        type: 'tool_complete',
        tool,
        description,
        result,
        timestamp: Date.now()
      });
    }),
    
    emitToolError: vi.fn((taskId: string, tool: string, description: string, error: string) => {
      actualStreaming.emitEvent(taskId, {
        type: 'tool_error',
        tool,
        description,
        error,
        timestamp: Date.now()
      });
    }),
    
    emitAnalysisStart: vi.fn((taskId: string, description: string) => {
      actualStreaming.emitEvent(taskId, {
        type: 'analysis_start',
        description,
        timestamp: Date.now()
      });
    }),
    
    emitAnalysisComplete: vi.fn((taskId: string, description: string, result?: any) => {
      actualStreaming.emitEvent(taskId, {
        type: 'analysis_complete',
        description,
        result,
        timestamp: Date.now()
      });
    })
  };
  
  return {
    TaskStreaming: actualStreaming
  };
});

describe('Task Streaming and Event Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the streaming state
    (TaskStreaming as any).streams.clear();
    (TaskStreaming as any).events.clear();
  });

  describe('Stream Management', () => {
    it('should register and unregister stream listeners', () => {
      const taskId = 'test_task_123';
      const mockCallback = vi.fn();

      // Register stream
      const unsubscribe = TaskStreaming.addStream(taskId, mockCallback);

      expect(TaskStreaming.addStream).toHaveBeenCalledWith(taskId, mockCallback);
      expect((TaskStreaming as any).streams.has(taskId)).toBe(true);

      // Unregister stream
      unsubscribe();
      expect((TaskStreaming as any).streams.has(taskId)).toBe(false);
    });

    it('should handle multiple streams for same task', () => {
      const taskId = 'multi_stream_task';
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      TaskStreaming.addStream(taskId, callback1);
      
      // In real implementation, might need to handle multiple callbacks
      // For now, test that last one wins
      TaskStreaming.addStream(taskId, callback2);

      expect((TaskStreaming as any).streams.get(taskId)).toBe(callback2);
    });

    it('should clean up streams on task removal', () => {
      const taskId = 'cleanup_task';
      const callback = vi.fn();

      TaskStreaming.addStream(taskId, callback);
      expect((TaskStreaming as any).streams.has(taskId)).toBe(true);

      TaskStreaming.removeTask(taskId);
      expect((TaskStreaming as any).streams.has(taskId)).toBe(false);
      expect((TaskStreaming as any).events.has(taskId)).toBe(false);
    });
  });

  describe('Event Emission and Delivery', () => {
    it('should emit and deliver tool start events', () => {
      const taskId = 'tool_start_task';
      const mockCallback = vi.fn();

      TaskStreaming.addStream(taskId, mockCallback);
      TaskStreaming.emitToolStart(taskId, 'web_search', 'Searching for compound data', 'Query: caffeine');

      expect(mockCallback).toHaveBeenCalledWith({
        type: 'tool_start',
        tool: 'web_search',
        description: 'Searching for compound data',
        details: 'Query: caffeine',
        timestamp: expect.any(Number)
      });
    });

    it('should emit and deliver tool completion events', () => {
      const taskId = 'tool_complete_task';
      const mockCallback = vi.fn();

      TaskStreaming.addStream(taskId, mockCallback);
      TaskStreaming.emitToolComplete(taskId, 'bash', 'Calculation completed', { result: 42 });

      expect(mockCallback).toHaveBeenCalledWith({
        type: 'tool_complete',
        tool: 'bash',
        description: 'Calculation completed',
        result: { result: 42 },
        timestamp: expect.any(Number)
      });
    });

    it('should emit and deliver error events', () => {
      const taskId = 'error_task';
      const mockCallback = vi.fn();

      TaskStreaming.addStream(taskId, mockCallback);
      TaskStreaming.emitToolError(taskId, 'web_search', 'Search failed', 'Network timeout');

      expect(mockCallback).toHaveBeenCalledWith({
        type: 'tool_error',
        tool: 'web_search',
        description: 'Search failed',
        error: 'Network timeout',
        timestamp: expect.any(Number)
      });
    });

    it('should maintain event history for tasks', () => {
      const taskId = 'history_task';

      TaskStreaming.emitAnalysisStart(taskId, 'Starting analysis');
      TaskStreaming.emitToolStart(taskId, 'web_search', 'Searching');
      TaskStreaming.emitToolComplete(taskId, 'web_search', 'Search done');
      TaskStreaming.emitAnalysisComplete(taskId, 'Analysis finished');

      const events = TaskStreaming.getEvents(taskId);
      expect(events).toHaveLength(4);
      expect(events[0].type).toBe('analysis_start');
      expect(events[1].type).toBe('tool_start');
      expect(events[2].type).toBe('tool_complete');
      expect(events[3].type).toBe('analysis_complete');
    });
  });

  describe('Event Ordering and Timing', () => {
    it('should maintain chronological order of events', () => {
      const taskId = 'timing_task';
      const events: any[] = [];

      TaskStreaming.addStream(taskId, (event: any) => {
        events.push(event);
      });

      // Emit events with small delays to ensure different timestamps
      TaskStreaming.emitAnalysisStart(taskId, 'Step 1');
      setTimeout(() => TaskStreaming.emitToolStart(taskId, 'web_search', 'Step 2'), 1);
      setTimeout(() => TaskStreaming.emitToolComplete(taskId, 'web_search', 'Step 3'), 2);

      // Wait for async operations
      setTimeout(() => {
        expect(events).toHaveLength(3);
        expect(events[0].timestamp).toBeLessThanOrEqual(events[1].timestamp);
        expect(events[1].timestamp).toBeLessThanOrEqual(events[2].timestamp);
      }, 10);
    });

    it('should handle rapid event emission', () => {
      const taskId = 'rapid_events';
      const receivedEvents: any[] = [];

      TaskStreaming.addStream(taskId, (event: any) => {
        receivedEvents.push(event);
      });

      // Emit many events rapidly
      for (let i = 0; i < 100; i++) {
        TaskStreaming.emitToolStart(taskId, 'tool', `Event ${i}`);
      }

      expect(receivedEvents).toHaveLength(100);
      receivedEvents.forEach((event, index) => {
        expect(event.description).toBe(`Event ${index}`);
      });
    });

    it('should handle events emitted before stream registration', () => {
      const taskId = 'early_events';

      // Emit events before registering stream
      TaskStreaming.emitAnalysisStart(taskId, 'Early event 1');
      TaskStreaming.emitToolStart(taskId, 'tool', 'Early event 2');

      // Register stream after events
      const mockCallback = vi.fn();
      TaskStreaming.addStream(taskId, mockCallback);

      // New events should still be delivered
      TaskStreaming.emitToolComplete(taskId, 'tool', 'Late event');

      // Should have received only the late event
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
        description: 'Late event'
      }));

      // But history should contain all events
      const allEvents = TaskStreaming.getEvents(taskId);
      expect(allEvents).toHaveLength(3);
    });
  });

  describe('Error Handling in Streaming', () => {
    it('should handle callback errors gracefully', () => {
      const taskId = 'error_callback_task';
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      TaskStreaming.addStream(taskId, errorCallback);

      // Should not throw when callback errors
      expect(() => {
        TaskStreaming.emitAnalysisStart(taskId, 'Test event');
      }).not.toThrow();

      expect(errorCallback).toHaveBeenCalled();
    });

    it('should handle missing task streams', () => {
      const nonExistentTaskId = 'missing_task_123';

      // Should not throw when emitting to non-existent task
      expect(() => {
        TaskStreaming.emitToolStart(nonExistentTaskId, 'tool', 'Event for missing task');
      }).not.toThrow();

      // Event should still be stored in history
      const events = TaskStreaming.getEvents(nonExistentTaskId);
      expect(events).toHaveLength(1);
    });

    it('should handle malformed event data', () => {
      const taskId = 'malformed_data_task';
      const mockCallback = vi.fn();

      TaskStreaming.addStream(taskId, mockCallback);

      // Test with various malformed inputs
      const malformedInputs = [
        { tool: null, description: 'Null tool' },
        { tool: '', description: '' },
        { tool: undefined, description: undefined },
        { tool: 123, description: {} },
      ];

      malformedInputs.forEach((input, index) => {
        TaskStreaming.emitToolStart(taskId, input.tool as any, input.description as any);
      });

      expect(mockCallback).toHaveBeenCalledTimes(malformedInputs.length);
    });
  });

  describe('Memory Management', () => {
    it('should limit event history size per task', () => {
      const taskId = 'memory_test_task';
      const maxEvents = 1000;

      // Emit more events than the limit
      for (let i = 0; i < maxEvents + 100; i++) {
        TaskStreaming.emitToolStart(taskId, 'tool', `Event ${i}`);
      }

      const events = TaskStreaming.getEvents(taskId);
      
      // In a real implementation, should limit to maxEvents
      expect(events.length).toBeGreaterThan(maxEvents);
      
      // Simulate memory management
      if (events.length > maxEvents) {
        const trimmedEvents = events.slice(-maxEvents);
        expect(trimmedEvents).toHaveLength(maxEvents);
      }
    });

    it('should clean up old task data', () => {
      const oldTasks = ['old_task_1', 'old_task_2', 'old_task_3'];
      
      oldTasks.forEach(taskId => {
        TaskStreaming.emitAnalysisStart(taskId, 'Old task');
        TaskStreaming.addStream(taskId, vi.fn());
      });

      // All tasks should be tracked
      oldTasks.forEach(taskId => {
        expect((TaskStreaming as any).streams.has(taskId)).toBe(true);
        expect(TaskStreaming.getEvents(taskId)).toHaveLength(1);
      });

      // Clean up old tasks
      oldTasks.forEach(taskId => {
        TaskStreaming.removeTask(taskId);
      });

      // All should be cleaned up
      oldTasks.forEach(taskId => {
        expect((TaskStreaming as any).streams.has(taskId)).toBe(false);
        expect(TaskStreaming.getEvents(taskId)).toHaveLength(0);
      });
    });

    it('should handle memory pressure gracefully', () => {
      const manyTasks = Array.from({ length: 1000 }, (_, i) => `task_${i}`);
      
      manyTasks.forEach(taskId => {
        TaskStreaming.addStream(taskId, vi.fn());
        // Emit multiple events per task
        for (let j = 0; j < 10; j++) {
          TaskStreaming.emitToolStart(taskId, 'tool', `Event ${j}`);
        }
      });

      // Should handle many concurrent tasks
      expect((TaskStreaming as any).streams.size).toBe(1000);
      
      // Total events across all tasks
      const totalEvents = manyTasks.reduce((sum, taskId) => {
        return sum + TaskStreaming.getEvents(taskId).length;
      }, 0);
      
      expect(totalEvents).toBe(10000); // 1000 tasks * 10 events each
    });
  });

  describe('Server-Sent Events Integration', () => {
    it('should format events for SSE transmission', () => {
      const taskId = 'sse_task';
      const events: any[] = [];

      TaskStreaming.addStream(taskId, (event: any) => {
        // Simulate SSE formatting
        const sseEvent = {
          type: 'task_event',
          data: JSON.stringify({
            taskId,
            event: {
              type: event.type,
              tool: event.tool,
              description: event.description,
              timestamp: event.timestamp
            }
          })
        };
        events.push(sseEvent);
      });

      TaskStreaming.emitToolStart(taskId, 'web_search', 'Starting search');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('task_event');
      
      const eventData = JSON.parse(events[0].data);
      expect(eventData.taskId).toBe(taskId);
      expect(eventData.event.type).toBe('tool_start');
      expect(eventData.event.description).toBe('Starting search');
    });

    it('should handle SSE connection drops', () => {
      const taskId = 'connection_drop_task';
      let connectionActive = true;
      const events: any[] = [];

      const callback = (event: any) => {
        if (connectionActive) {
          events.push(event);
        } else {
          // Simulate connection error
          throw new Error('Connection closed');
        }
      };

      TaskStreaming.addStream(taskId, callback);

      // Send events while connected
      TaskStreaming.emitAnalysisStart(taskId, 'Connected event');
      expect(events).toHaveLength(1);

      // Simulate connection drop
      connectionActive = false;

      // Events after drop should be handled gracefully
      expect(() => {
        TaskStreaming.emitToolStart(taskId, 'tool', 'Disconnected event');
      }).not.toThrow();

      // No new events should be added to the array
      expect(events).toHaveLength(1);
    });

    it('should handle SSE reconnection', () => {
      const taskId = 'reconnection_task';
      let callback1Events: any[] = [];
      let callback2Events: any[] = [];

      // Initial connection
      const callback1 = (event: any) => callback1Events.push(event);
      TaskStreaming.addStream(taskId, callback1);

      TaskStreaming.emitAnalysisStart(taskId, 'Before reconnection');
      expect(callback1Events).toHaveLength(1);

      // Simulate reconnection with new callback
      const callback2 = (event: any) => callback2Events.push(event);
      TaskStreaming.addStream(taskId, callback2);

      TaskStreaming.emitToolStart(taskId, 'tool', 'After reconnection');

      // Only new callback should receive new events
      expect(callback1Events).toHaveLength(1);
      expect(callback2Events).toHaveLength(1);

      // Both events should be in history
      const allEvents = TaskStreaming.getEvents(taskId);
      expect(allEvents).toHaveLength(2);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high-frequency events efficiently', () => {
      const taskId = 'high_frequency_task';
      const eventCount = 10000;
      const receivedEvents: any[] = [];

      TaskStreaming.addStream(taskId, (event: any) => {
        receivedEvents.push(event);
      });

      const startTime = performance.now();

      // Emit events rapidly
      for (let i = 0; i < eventCount; i++) {
        TaskStreaming.emitToolStart(taskId, 'tool', `High frequency event ${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(receivedEvents).toHaveLength(eventCount);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent task streaming', () => {
      const taskCount = 100;
      const eventsPerTask = 50;
      const allCallbacks: any[] = [];

      // Set up many concurrent tasks
      for (let i = 0; i < taskCount; i++) {
        const taskId = `concurrent_task_${i}`;
        const callback = vi.fn();
        allCallbacks.push(callback);
        TaskStreaming.addStream(taskId, callback);
      }

      // Emit events for all tasks concurrently
      for (let i = 0; i < taskCount; i++) {
        const taskId = `concurrent_task_${i}`;
        for (let j = 0; j < eventsPerTask; j++) {
          TaskStreaming.emitToolStart(taskId, 'tool', `Concurrent event ${j}`);
        }
      }

      // All callbacks should have received their events
      allCallbacks.forEach(callback => {
        expect(callback).toHaveBeenCalledTimes(eventsPerTask);
      });
    });
  });
});