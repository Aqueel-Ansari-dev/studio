import type { Task, Project } from '@/types/database';

export interface TaskRiskPrediction {
  projectId: string;
  riskLevel: 'on-track' | 'at-risk';
  reason: string;
}

/**
 * Simple heuristic to predict if a project is at risk of missing deadline.
 */
export class TaskPredictor {
  static predict(
    project: Project,
    tasks: Task[],
    today: Date = new Date(),
    sensitivity: 'low' | 'medium' | 'high' = 'medium'
  ): TaskRiskPrediction {
    const total = tasks.length;
    const incomplete = tasks.filter(t => t.status !== 'completed' && t.status !== 'verified').length;
    const pctIncomplete = total === 0 ? 0 : incomplete / total;
    const daysLeft = project.dueDate ? Math.ceil((new Date(project.dueDate as any).getTime() - today.getTime()) / 86400000) : 30;
    const threshold = sensitivity === 'high' ? 0.2 : sensitivity === 'low' ? 0.5 : 0.3;
    if (pctIncomplete > threshold && daysLeft < 7) {
      return { projectId: project.id, riskLevel: 'at-risk', reason: 'High incomplete tasks near deadline' };
    }
    return { projectId: project.id, riskLevel: 'on-track', reason: 'Sufficient progress' };
  }
}
