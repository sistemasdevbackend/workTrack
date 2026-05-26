export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
export type Status = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type StepType = 'DATABASE' | 'CODE' | 'TESTING';

export interface Team {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  team_id: string;
  assigned_to: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: Status;
  created_at: string;
  updated_at: string;
  start_date: string | null;
  end_date: string | null;
  created_by: string;
}

export interface TaskStep {
  id: string;
  activity_id: string;
  step_type: StepType;
  title: string;
  description: string | null;
  completed: boolean;
  order_index: number;
  created_at: string;
}

export interface Comment {
  id: string;
  activity_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityRevision {
  id: string;
  activity_id: string;
  revision_number: number;
  status: string;
  reviewed_by: string | null;
  comments: string | null;
  created_at: string;
}
