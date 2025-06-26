import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskHistory } from '../TaskHistory/TaskHistory';
import { api } from '../../services/api';

vi.mock('../../services/api');

describe('TaskHistory Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Running Tasks Persistence', () => {
    test('should show running tasks with events when returning to page', async () => {
      // Mock API responses
      vi.mocked(api.getSessionTasks).mockResolvedValue({
        tasks: [
          {
            id: 'running-task-1',
            prompt: 'Analyze data',
            status: 'processing',
            created_at: new Date().toISOString(),
            analysis: '',
            error_message: undefined
          }
        ]
      });

      vi.mocked(api.getTaskStatus).mockResolvedValue({
        taskId: 'running-task-1',
        status: 'processing',
        events: [
          {
            type: 'analysis',
            description: 'Starting analysis...',
            status: 'completed',
            timestamp: new Date().toISOString()
          },
          {
            type: 'search',
            description: 'Searching scientific databases',
            status: 'running',
            timestamp: new Date().toISOString()
          }
        ]
      });

      render(<TaskHistory sessionId="test-session" />);

      // Wait for tasks to load
      await waitFor(() => {
        expect(screen.getByText('Analyze data')).toBeInTheDocument();
      });

      // Click to expand the running task
      const taskElement = screen.getByText('Analyze data');
      await userEvent.click(taskElement);

      // Should show progress with events
      await waitFor(() => {
        expect(screen.getByText('Progress:')).toBeInTheDocument();
        expect(screen.getByText('Starting analysis...')).toBeInTheDocument();
        expect(screen.getByText('Searching scientific databases')).toBeInTheDocument();
      });

      // Verify the running indicator
      const runningIndicator = screen.getByText('Searching scientific databases')
        .previousElementSibling;
      expect(runningIndicator).toHaveClass('animate-pulse');
    });

    test('should poll for updates on running tasks', async () => {
      let callCount = 0;
      
      vi.mocked(api.getSessionTasks).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            tasks: [{
              id: 'polling-task',
              prompt: 'Long running task',
              status: 'processing',
              created_at: new Date().toISOString()
            }]
          };
        } else {
          // Second call shows completed
          return {
            tasks: [{
              id: 'polling-task',
              prompt: 'Long running task',
              status: 'completed',
              created_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              analysis: 'Task completed successfully'
            }]
          };
        }
      });

      render(<TaskHistory sessionId="test-session" />);

      // Initially shows processing
      await waitFor(() => {
        expect(screen.getByText('processing')).toBeInTheDocument();
      });

      // Wait for polling to update status
      await waitFor(() => {
        expect(screen.getByText('completed')).toBeInTheDocument();
      }, { timeout: 6000 });

      expect(api.getSessionTasks).toHaveBeenCalledTimes(2);
    });
  });

  describe('Multiple Browser Tabs', () => {
    test('should sync task updates across tabs via polling', async () => {
      const tasks = [
        {
          id: 'shared-task',
          prompt: 'Shared analysis',
          status: 'processing' as const,
          created_at: new Date().toISOString()
        }
      ];

      vi.mocked(api.getSessionTasks).mockResolvedValue({ tasks });
      vi.mocked(api.getTaskStatus).mockResolvedValue({
        taskId: 'shared-task',
        status: 'processing',
        events: [
          {
            type: 'analysis',
            description: 'Updated from another tab',
            status: 'running',
            timestamp: new Date().toISOString()
          }
        ]
      });

      render(<TaskHistory sessionId="test-session" />);

      await waitFor(() => {
        expect(screen.getByText('Shared analysis')).toBeInTheDocument();
      });

      // Expand to see events
      await userEvent.click(screen.getByText('Shared analysis'));

      await waitFor(() => {
        expect(screen.getByText('Updated from another tab')).toBeInTheDocument();
      });
    });
  });

  describe('Error Recovery', () => {
    test('should handle API errors gracefully', async () => {
      vi.mocked(api.getSessionTasks).mockRejectedValue(
        new Error('Network error')
      );

      render(<TaskHistory sessionId="test-session" />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load task history')).toBeInTheDocument();
      });
    });

    test('should continue polling even if one request fails', async () => {
      let callCount = 0;
      
      vi.mocked(api.getSessionTasks).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            tasks: [{
              id: 'resilient-task',
              prompt: 'Test task',
              status: 'processing',
              created_at: new Date().toISOString()
            }]
          };
        } else if (callCount === 2) {
          throw new Error('Temporary network error');
        } else {
          return {
            tasks: [{
              id: 'resilient-task',
              prompt: 'Test task',
              status: 'completed',
              created_at: new Date().toISOString()
            }]
          };
        }
      });

      render(<TaskHistory sessionId="test-session" />);

      // Should show initial state
      await waitFor(() => {
        expect(screen.getByText('processing')).toBeInTheDocument();
      });

      // Should eventually show completed despite error
      await waitFor(() => {
        expect(screen.getByText('completed')).toBeInTheDocument();
      }, { timeout: 12000 });
    });
  });

  describe('Performance', () => {
    test('should not poll when all tasks are completed', async () => {
      vi.mocked(api.getSessionTasks).mockResolvedValue({
        tasks: [
          {
            id: 'completed-1',
            prompt: 'Task 1',
            status: 'completed',
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          },
          {
            id: 'completed-2',
            prompt: 'Task 2',
            status: 'failed',
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            error_message: 'Task failed'
          }
        ]
      });

      render(<TaskHistory sessionId="test-session" />);

      await waitFor(() => {
        expect(screen.getByText('Task 1')).toBeInTheDocument();
        expect(screen.getByText('Task 2')).toBeInTheDocument();
      });

      // Wait to ensure no additional calls
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Should only be called once (initial load)
      expect(api.getSessionTasks).toHaveBeenCalledTimes(1);
    });
  });
});