// Streaming utilities for real-time task progress

export interface TaskEvent {
  taskId: string;
  type: 'tool_start' | 'tool_complete' | 'tool_error' | 'analysis_start' | 'analysis_complete';
  tool?: 'web_search' | 'bash' | 'structured_output';
  description: string;
  details?: string;
  timestamp: number;
  data?: any;
}

// Simple event store for streaming (in production, use Redis or similar)
const taskEvents = new Map<string, TaskEvent[]>();
const activeStreams = new Map<string, Set<(event: TaskEvent) => void>>();

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

  static emitToolComplete(taskId: string, tool: TaskEvent['tool'], description: string, data?: any) {
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

  static emitAnalysisComplete(taskId: string, description: string, data?: any) {
    this.addEvent({
      taskId,
      type: 'analysis_complete',
      description,
      data,
      timestamp: Date.now(),
    });
  }
}