import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState, useCallback } from 'react';

interface TaskStep {
  id: string;
  type: 'search' | 'analysis' | 'code' | 'validation';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  details?: string;
  timestamp: Date;
}

// Custom hook for streaming state management (extracted from App.tsx logic)
const useTaskStreaming = () => {
  const [taskSteps, setTaskSteps] = useState<TaskStep[]>([]);

  const addTaskStep = useCallback((step: Omit<TaskStep, 'id' | 'timestamp'>) => {
    const newStep: TaskStep = {
      ...step,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
    };
    setTaskSteps(prev => [...prev, newStep]);
    return newStep.id;
  }, []);

  const updateTaskStep = useCallback((stepId: string, updates: Partial<TaskStep>) => {
    setTaskSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, ...updates } : step
    ));
  }, []);

  const clearTaskSteps = useCallback(() => {
    setTaskSteps([]);
  }, []);

  return {
    taskSteps,
    addTaskStep,
    updateTaskStep,
    clearTaskSteps,
  };
};

describe('Task Streaming State Management', () => {
  beforeEach(() => {
    // Mock Math.random for consistent IDs in tests
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);
    // Mock Date for consistent timestamps
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('addTaskStep', () => {
    it('should add a new step with generated ID and timestamp', () => {
      const { result } = renderHook(() => useTaskStreaming());

      act(() => {
        result.current.addTaskStep({
          type: 'analysis',
          description: 'Test step',
          status: 'pending',
        });
      });

      expect(result.current.taskSteps).toHaveLength(1);
      expect(result.current.taskSteps[0]).toMatchObject({
        type: 'analysis',
        description: 'Test step',
        status: 'pending',
        id: expect.any(String),
        timestamp: expect.any(Date),
      });
    });

    it('should return the generated step ID', () => {
      const { result } = renderHook(() => useTaskStreaming());
      let stepId: string;

      act(() => {
        stepId = result.current.addTaskStep({
          type: 'search',
          description: 'Search step',
          status: 'running',
        });
      });

      expect(stepId!).toBe(result.current.taskSteps[0].id);
    });

    it('should add multiple steps in order', () => {
      const { result } = renderHook(() => useTaskStreaming());

      act(() => {
        result.current.addTaskStep({
          type: 'analysis',
          description: 'First step',
          status: 'completed',
        });
        result.current.addTaskStep({
          type: 'search',
          description: 'Second step',
          status: 'running',
        });
      });

      expect(result.current.taskSteps).toHaveLength(2);
      expect(result.current.taskSteps[0].description).toBe('First step');
      expect(result.current.taskSteps[1].description).toBe('Second step');
    });

    it('should include optional details when provided', () => {
      const { result } = renderHook(() => useTaskStreaming());

      act(() => {
        result.current.addTaskStep({
          type: 'code',
          description: 'Running calculations',
          status: 'running',
          details: 'Processing molecular descriptors',
        });
      });

      expect(result.current.taskSteps[0].details).toBe('Processing molecular descriptors');
    });
  });

  describe('updateTaskStep', () => {
    it('should update an existing step by ID', () => {
      const { result } = renderHook(() => useTaskStreaming());
      let stepId: string;

      act(() => {
        stepId = result.current.addTaskStep({
          type: 'validation',
          description: 'Validating data',
          status: 'running',
        });
      });

      act(() => {
        result.current.updateTaskStep(stepId!, {
          status: 'completed',
          details: 'Validation finished successfully',
        });
      });

      const updatedStep = result.current.taskSteps[0];
      expect(updatedStep.status).toBe('completed');
      expect(updatedStep.details).toBe('Validation finished successfully');
      expect(updatedStep.description).toBe('Validating data'); // Should remain unchanged
    });

    it('should not affect other steps when updating one', () => {
      const { result } = renderHook(() => useTaskStreaming());
      let step1Id: string, step2Id: string;

      act(() => {
        step1Id = result.current.addTaskStep({
          type: 'analysis',
          description: 'Step 1',
          status: 'completed',
        });
        step2Id = result.current.addTaskStep({
          type: 'search',
          description: 'Step 2',
          status: 'running',
        });
      });

      act(() => {
        result.current.updateTaskStep(step2Id!, { status: 'completed' });
      });

      expect(result.current.taskSteps[0].status).toBe('completed'); // Step 1 unchanged
      expect(result.current.taskSteps[1].status).toBe('completed'); // Step 2 updated
    });

    it('should handle updates to non-existent step IDs gracefully', () => {
      const { result } = renderHook(() => useTaskStreaming());

      act(() => {
        result.current.addTaskStep({
          type: 'analysis',
          description: 'Existing step',
          status: 'running',
        });
      });

      act(() => {
        result.current.updateTaskStep('non-existent-id', { status: 'completed' });
      });

      // Should not crash and existing step should remain unchanged
      expect(result.current.taskSteps).toHaveLength(1);
      expect(result.current.taskSteps[0].status).toBe('running');
    });

    it('should allow partial updates', () => {
      const { result } = renderHook(() => useTaskStreaming());
      let stepId: string;

      act(() => {
        stepId = result.current.addTaskStep({
          type: 'code',
          description: 'Original description',
          status: 'pending',
          details: 'Original details',
        });
      });

      act(() => {
        result.current.updateTaskStep(stepId!, { status: 'running' });
      });

      const step = result.current.taskSteps[0];
      expect(step.status).toBe('running');
      expect(step.description).toBe('Original description');
      expect(step.details).toBe('Original details');
    });
  });

  describe('clearTaskSteps', () => {
    it('should clear all steps', () => {
      const { result } = renderHook(() => useTaskStreaming());

      act(() => {
        result.current.addTaskStep({
          type: 'analysis',
          description: 'Step 1',
          status: 'completed',
        });
        result.current.addTaskStep({
          type: 'search',
          description: 'Step 2',
          status: 'running',
        });
      });

      expect(result.current.taskSteps).toHaveLength(2);

      act(() => {
        result.current.clearTaskSteps();
      });

      expect(result.current.taskSteps).toHaveLength(0);
    });

    it('should handle clearing when no steps exist', () => {
      const { result } = renderHook(() => useTaskStreaming());

      act(() => {
        result.current.clearTaskSteps();
      });

      expect(result.current.taskSteps).toHaveLength(0);
    });
  });

  describe('Step ID Generation', () => {
    it('should generate unique IDs for different steps', () => {
      vi.spyOn(Math, 'random')
        .mockReturnValueOnce(0.123)
        .mockReturnValueOnce(0.456);

      const { result } = renderHook(() => useTaskStreaming());

      act(() => {
        result.current.addTaskStep({
          type: 'analysis',
          description: 'Step 1',
          status: 'pending',
        });
        result.current.addTaskStep({
          type: 'search',
          description: 'Step 2',
          status: 'pending',
        });
      });

      const ids = result.current.taskSteps.map(step => step.id);
      expect(ids[0]).not.toBe(ids[1]);
      expect(new Set(ids).size).toBe(2); // All IDs should be unique
    });
  });

  describe('Timestamp Generation', () => {
    it('should use current time for step timestamps', () => {
      const mockTime = new Date('2024-01-01T15:30:45Z');
      vi.setSystemTime(mockTime);

      const { result } = renderHook(() => useTaskStreaming());

      act(() => {
        result.current.addTaskStep({
          type: 'validation',
          description: 'Test step',
          status: 'pending',
        });
      });

      expect(result.current.taskSteps[0].timestamp).toEqual(mockTime);
    });
  });
});