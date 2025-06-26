// Streaming utilities for real-time task progress

import { LRUCache } from './cache';
import type { TaskEventData } from '../types/data';

export interface TaskEvent {
  taskId: string;
  type: 'tool_start' | 'tool_complete' | 'tool_error' | 'analysis_start' | 'analysis_complete';
  tool?: 'web_search' | 'bash' | 'structured_output';
  description: string;
  details?: string;
  timestamp: number;
  data?: TaskEventData;
}

// LRU cache for task events to prevent memory leaks
// Max 500 tasks, 30 minute TTL (tasks should complete within this time)
const taskEvents = new LRUCache<string, TaskEvent[]>(500, 1800);
const activeStreams = new Map<string, Set<(event: TaskEvent) => void>>();

// Cleanup completed tasks after 5 minutes
const CLEANUP_DELAY = 5 * 60 * 1000;

export class TaskStreaming {
  static addEvent(event: TaskEvent) {
    const events = taskEvents.get(event.taskId) || [];
    events.push(event);
    taskEvents.set(event.taskId, events);

    // Notify all active streams for this task
    const streams = activeStreams.get(event.taskId);
    if (streams) {
      streams.forEach(callback => callback(event));
    }
  }

  static getEvents(taskId: string): TaskEvent[] {
    return taskEvents.get(taskId) || [];
  }

  static addStream(taskId: string, callback: (event: TaskEvent) => void) {
    const streams = activeStreams.get(taskId) || new Set();
    streams.add(callback);
    activeStreams.set(taskId, streams);

    // Send historical events to new stream
    const events = this.getEvents(taskId);
    events.forEach(event => callback(event));

    return () => {
      streams.delete(callback);
      if (streams.size === 0) {
        activeStreams.delete(taskId);
      }
    };
  }

  static removeTask(taskId: string) {
    taskEvents.delete(taskId);
    activeStreams.delete(taskId);
  }

  // Schedule task cleanup after completion
  static scheduleTaskCleanup(taskId: string) {
    setTimeout(() => {
      // Only remove if no active streams
      if (!activeStreams.has(taskId)) {
        this.removeTask(taskId);
      }
    }, CLEANUP_DELAY);
  }

  // Helper methods to emit common events
  static emitToolStart(taskId: string, tool: TaskEvent['tool'], description: string, details?: string) {
    this.addEvent({
      taskId,
      type: 'tool_start',
      tool,
      description,
      details,
      timestamp: Date.now(),
    });
  }

  static emitToolComplete(taskId: string, tool: TaskEvent['tool'], description: string, data?: TaskEventData) {
    this.addEvent({
      taskId,
      type: 'tool_complete',
      tool,
      description,
      data,
      timestamp: Date.now(),
    });
  }

  static emitToolError(taskId: string, tool: TaskEvent['tool'], description: string, error: string) {
    this.addEvent({
      taskId,
      type: 'tool_error',
      tool,
      description,
      details: error,
      timestamp: Date.now(),
    });
  }

  static emitAnalysisStart(taskId: string, description: string) {
    this.addEvent({
      taskId,
      type: 'analysis_start',
      description,
      timestamp: Date.now(),
    });
  }

  static emitAnalysisComplete(taskId: string, description: string, data?: TaskEventData) {
    this.addEvent({
      taskId,
      type: 'analysis_complete',
      description,
      data,
      timestamp: Date.now(),
    });
  }
}