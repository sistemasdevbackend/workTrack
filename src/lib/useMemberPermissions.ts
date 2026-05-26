import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export type FeatureSlug =
  | 'create_activity_becario'
  | 'create_activity_developer'
  | 'add_documentation'
  | 'add_changelog'
  | 'view_changelog'
  | 'send_to_review'
  | 'move_to_testing'
  | 'delete_activity'
  | 'view_intern_activities';

// Default permissions by position (fallback when no explicit row exists)
const DEFAULTS: Record<string, Record<FeatureSlug, boolean>> = {
  becario: {
    create_activity_becario:    false,
    create_activity_developer:  false,
    add_documentation:          false,
    add_changelog:              false,
    view_changelog:             false,
    send_to_review:             true,
    move_to_testing:            true,
    delete_activity:            false,
    view_intern_activities:     false,
  },
  _default: {
    create_activity_becario:    true,
    create_activity_developer:  true,
    add_documentation:          true,
    add_changelog:              true,
    view_changelog:             true,
    send_to_review:             true,
    move_to_testing:            true,
    delete_activity:            false,
    view_intern_activities:     true,
  },
};

export type PermissionsMap = Record<FeatureSlug, boolean>;

export function useMemberPermissions(memberId: string, position: string) {
  const [permissions, setPermissions] = useState<PermissionsMap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('member_permissions')
        .select('feature, enabled')
        .eq('team_member_id', memberId);

      const posKey = position.toLowerCase();
      const defaults = DEFAULTS[posKey] ?? DEFAULTS['_default'];

      const map: PermissionsMap = { ...defaults };

      (data ?? []).forEach((row: { feature: string; enabled: boolean }) => {
        if (row.feature in map) {
          (map as any)[row.feature] = row.enabled;
        }
      });

      setPermissions(map);
      setLoading(false);
    };

    load();
  }, [memberId, position]);

  const can = (feature: FeatureSlug): boolean => {
    if (!permissions) {
      const posKey = position.toLowerCase();
      return (DEFAULTS[posKey] ?? DEFAULTS['_default'])[feature];
    }
    return permissions[feature] ?? true;
  };

  return { permissions, loading, can };
}
