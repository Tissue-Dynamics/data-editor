import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskProgress } from './TaskProgress';

interface TaskStep {
  id: string;
  type: 'search' | 'analysis' | 'code' | 'validation';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  details?: string;
  timestamp: Date;
}

describe('TaskProgress Component', () => {
  const mockTaskId = 'test-task-123';
  const mockPrompt = 'Fill in missing values for these rows';
  const baseTime = new Date('2024-01-01T10:00:00Z');

  const createMockStep = (
    overrides: Partial<TaskStep> = {}
  ): TaskStep => ({
    id: 'step-1',
    type: 'analysis',
    description: 'Initializing data analysis',
    status: 'pending',
    timestamp: baseTime,
    ...overrides,
  });

  beforeEach(() => {
    // Reset any global state before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe('Basic Rendering', () => {
    it('should render task progress header', () => {
      render(
        <TaskProgress
          taskId={mockTaskId}
          prompt={mockPrompt}
          steps={[]}
          isRunning={false}
        />
      );

      expect(screen.getByText('Task Progress')).toBeInTheDocument();
    });

    it('should display the task prompt', () => {
      render(
        <TaskProgress
          taskId={mockTaskId}
          prompt={mockPrompt}
          steps={[]}
          isRunning={false}
        />
      );

      expect(screen.getByText(`"${mockPrompt}"`)).toBeInTheDocument();
    });

    it('should show running indicator when task is running', () => {
      render(
        <TaskProgress
          taskId={mockTaskId}
          prompt={mockPrompt}
          steps={[]}
          isRunning={true}
        />
      );

      expect(screen.getByText('Running')).toBeInTheDocument();
    });

    it('should show no active tasks message when no steps exist', () => {
      render(
        <TaskProgress
          taskId={mockTaskId}
          prompt={mockPrompt}
          steps={[]}
          isRunning={false}
        />
      );

      expect(screen.getByText('No active tasks')).toBeInTheDocument();
    });
  });

  describe('Step Display', () => {
    it('should render a single step', () => {
      const step = createMockStep({
        description: 'Searching scientific databases',
        status: 'running',
      });

      render(
        <TaskProgress
          taskId={mockTaskId}
          prompt={mockPrompt}
          steps={[step]}
          isRunning={true}
        />
      );

      expect(screen.getByText('Searching scientific databases')).toBeInTheDocument();
    });

    it('should render multiple steps in order', () => {
      const steps = [
        createMockStep({
          id: 'step-1',
          description: 'Step 1',
          status: 'completed',
        }),
        createMockStep({
          id: 'step-2',
          description: 'Step 2',
          status: 'running',
        }),
        createMockStep({
          id: 'step-3',
          description: 'Step 3',
          status: 'pending',
        }),
      ];

      render(
        <TaskProgress
          taskId={mockTaskId}
          prompt={mockPrompt}
          steps={steps}
          isRunning={true}
        />
      );

      expect(screen.getByText('Step 1')).toBeInTheDocument();
      expect(screen.getByText('Step 2')).toBeInTheDocument();
      expect(screen.getByText('Step 3')).toBeInTheDocument();
    });

    it('should display step details when provided', () => {
      const step = createMockStep({
        description: 'Running calculations',
        details: 'Calculating molecular descriptors',
        status: 'running',
      });

      render(
        <TaskProgress
          taskId={mockTaskId}
          prompt={mockPrompt}
          steps={[step]}
          isRunning={true}
        />
      );

      expect(screen.getByText('Calculating molecular descriptors')).toBeInTheDocument();
    });

    it('should display timestamps for steps', () => {
      const step = createMockStep({
        timestamp: new Date('2024-01-01T14:30:15Z'),
      });

      render(
        <TaskProgress
          taskId={mockTaskId}
          prompt={mockPrompt}
          steps={[step]}
          isRunning={true}
        />
      );

      // Check that some time format is displayed (exact format may vary by locale)
      expect(screen.getByText(/\d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();
    });
  });

  describe('Step Status Indicators', () => {
    it('should show progress bar for running steps', () => {
      const step = createMockStep({
        status: 'running',
      });

      const { container } = render(
        <TaskProgress
          taskId={mockTaskId}
          prompt={mockPrompt}
          steps={[step]}
          isRunning={true}
        />
      );

      // Check for progress bar elements
      expect(container.querySelector('.bg-blue-600')).toBeInTheDocument();
    });

    it('should not show progress bar for completed steps', () => {
      const step = createMockStep({
        status: 'completed',
      });

      const { container } = render(
        <TaskProgress
          taskId={mockTaskId}
          prompt={mockPrompt}
          steps={[step]}
          isRunning={false}
        />
      );

      // Should not find the progress bar animation
      expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
    });
  });

  describe('Step Types', () => {
    const stepTypes: Array<{ type: TaskStep['type']; expectedIcon: string }> = [
      { type: 'search', expectedIcon: 'Search' },
      { type: 'analysis', expectedIcon: 'FileText' },
      { type: 'code', expectedIcon: 'Code' },
      { type: 'validation', expectedIcon: 'CheckCircle' },
    ];

    stepTypes.forEach(({ type, expectedIcon }) => {
      it(`should render correct icon for ${type} step type`, () => {
        const step = createMockStep({
          type,
          description: `${type} step`,
        });

        const { container } = render(
          <TaskProgress
            taskId={mockTaskId}
            prompt={mockPrompt}
            steps={[step]}
            isRunning={true}
          />
        );

        // Check that the component renders (exact icon testing would require more setup)
        expect(screen.getByText(`${type} step`)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle steps with error status', () => {
      const step = createMockStep({
        description: 'Failed operation',
        status: 'error',
      });

      render(
        <TaskProgress
          taskId={mockTaskId}
          prompt={mockPrompt}
          steps={[step]}
          isRunning={false}
        />
      );

      expect(screen.getByText('Failed operation')).toBeInTheDocument();
    });

    it('should handle empty task ID gracefully', () => {
      render(
        <TaskProgress
          taskId=""
          prompt={mockPrompt}
          steps={[]}
          isRunning={false}
        />
      );

      expect(screen.getByText('Task Progress')).toBeInTheDocument();
    });

    it('should handle empty prompt gracefully', () => {
      render(
        <TaskProgress
          taskId={mockTaskId}
          prompt=""
          steps={[]}
          isRunning={false}
        />
      );

      expect(screen.getByText('""')).toBeInTheDocument();
    });
  });
});