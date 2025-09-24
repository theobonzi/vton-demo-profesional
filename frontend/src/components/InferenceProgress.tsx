import React from 'react';
import { cn } from '@/lib/utils';
import { InferenceTaskStatusResponse } from '@/services/inferenceService';

interface InferenceProgressProps {
  status: InferenceTaskStatusResponse;
  className?: string;
}

export function InferenceProgress({ status, className }: InferenceProgressProps) {
  const getStatusColor = (statusType: string) => {
    switch (statusType) {
      case 'IN_QUEUE':
        return 'bg-blue-500';
      case 'IN_PROGRESS':
        return 'bg-blue-500';
      case 'COMPLETED':
        return 'bg-green-500';
      case 'FAILED':
        return 'bg-red-500';
      case 'CANCELLED':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (statusType: string) => {
    switch (statusType) {
      case 'IN_QUEUE':
        return (
          <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        );
      case 'IN_PROGRESS':
        return (
          <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        );
      case 'COMPLETED':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'FAILED':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'CANCELLED':
        return (
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={cn('w-full space-y-3', className)}>
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon(status.status)}
          <span className="text-sm font-medium text-foreground">
            {status.status.replace('_', ' ').toLowerCase()}
          </span>
        </div>
        <span className="text-xs text-text-subtle">
          {Math.round(status.progress)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={cn(
            'h-2 rounded-full transition-all duration-300 ease-out',
            getStatusColor(status.status)
          )}
          style={{ width: `${status.progress}%` }}
        />
      </div>

      {/* Status message */}
      <p className="text-xs text-text-subtle">
        {status.message}
      </p>

      {/* Error message if any */}
      {status.error_message && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-xs text-red-600">
            {status.error_message}
          </p>
        </div>
      )}
    </div>
  );
}

interface InferenceProgressListProps {
  tasks: InferenceTaskStatusResponse[];
  className?: string;
}

export function InferenceProgressList({ tasks, className }: InferenceProgressListProps) {
  if (tasks.length === 0) {
    return null;
  }

  // Calculer les statistiques globales
  const totalProgress = tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length;
  const completedTasks = tasks.filter(task => task.status === 'COMPLETED').length;
  const failedTasks = tasks.filter(task => task.status === 'FAILED').length;
  const inProgressTasks = tasks.filter(task => task.status === 'IN_PROGRESS').length;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Global progress */}
      <div className="p-4 bg-card rounded-lg border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-foreground">
            Progress global ({completedTasks}/{tasks.length} terminées)
          </h3>
          <span className="text-xs text-text-subtle">
            {Math.round(totalProgress)}%
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="h-2 rounded-full bg-blue-500 transition-all duration-300"
            style={{ width: `${totalProgress}%` }}
          />
        </div>

        <div className="flex items-center gap-4 text-xs text-text-subtle">
          {inProgressTasks > 0 && (
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              {inProgressTasks} en cours
            </span>
          )}
          {completedTasks > 0 && (
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              {completedTasks} terminées
            </span>
          )}
          {failedTasks > 0 && (
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              {failedTasks} échouées
            </span>
          )}
        </div>
      </div>

      {/* Individual task progress */}
      <div className="space-y-2">
        {tasks.map((task, index) => (
          <div key={task.task_id} className="p-3 bg-surface-elevated rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-foreground">
                Vêtement {index + 1}
              </span>
              <span className="text-xs text-text-subtle">
                {task.task_id.slice(0, 8)}...
              </span>
            </div>
            <InferenceProgress status={task} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default InferenceProgress;