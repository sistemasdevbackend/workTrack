import { supabase } from './supabase';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';
export type AuditResourceType =
  | 'changelog_entry'
  | 'changelog_project'
  | 'doc_entry';

interface AuditParams {
  teamId: string;
  actorId?: string | null;       // auth.uid() for managers (uuid)
  actorMemberId?: string | null; // team_member_id for collaborators
  actorName: string;
  actorType: 'manager' | 'collaborator';
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  resourceTitle: string;
  metadata?: Record<string, unknown>;
}

export async function logAudit(params: AuditParams): Promise<void> {
  await supabase.from('audit_logs').insert({
    team_id:        params.teamId,
    actor_id:       params.actorType === 'manager' ? params.actorId ?? null : null,
    actor_member_id: params.actorMemberId ?? null,
    actor_name:     params.actorName,
    actor_role:     params.actorType,
    actor_type:     params.actorType,
    action:         params.action,
    entity_type:    params.resourceType,
    entity_id:      params.resourceId ?? null,
    entity_label:   params.resourceTitle,
    meta:           params.metadata ?? {},
  });
}
