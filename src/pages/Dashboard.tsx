import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Navbar, { Sidebar } from '../components/Navbar';
import type { NotifNavTarget } from '../components/NotificationBell';
import CollaboratorsSection from './CollaboratorsSection';
import ActivitiesSection from './ActivitiesSection';
import SettingsSection from './SettingsSection';
import CalendarSection from './CalendarSection';
import ChangelogManagerSection from './ChangelogManagerSection';
import DocumentationSection from '../components/DocumentationSection';
import AuditLogSection from './AuditLogSection';
import ReviewSection from './ReviewSection';
import PermissionsSection from './PermissionsSection';
import ManagerAlertModal, { type AlertActivity } from '../components/ManagerAlertModal';

import SuperAdminPanel from './SuperAdminDashboard';
import ProjectsSection from './ProjectsSection';
import UtilitiesSection from './UtilitiesSection';

type Section = 'collaborators' | 'activities' | 'review' | 'teams' | 'settings' | 'calendar' | 'changelog' | 'documentation' | 'audit' | 'admin' | 'permissions' | 'projects' | 'utilities';

interface DashboardProps {
  isSuperAdmin?: boolean;
  userId?: string;
  assignedTeamId?: string | null;
  hasViewerGrants?: boolean;
  onSwitchToSupervisor?: () => void;
}

export default function Dashboard({ isSuperAdmin = false, userId: propUserId = '', assignedTeamId: propTeamId = null, hasViewerGrants = false, onSwitchToSupervisor }: DashboardProps) {
  console.log('[Dashboard] props:', { isSuperAdmin, propUserId, propTeamId, hasViewerGrants });
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [teamName, setTeamName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [managerMemberId, setManagerMemberId] = useState<string>('');
  const [managerName, setManagerName] = useState<string>('');
  const [activeSection, setActiveSection] = useState<Section>('activities');
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [pendingActivityId, setPendingActivityId] = useState<string | null>(null);
  const [pendingChangelogEntryId, setPendingChangelogEntryId] = useState<string | null>(null);

  const [alertOverdue, setAlertOverdue] = useState<AlertActivity[]>([]);
  const [alertDueSoon, setAlertDueSoon] = useState<AlertActivity[]>([]);
  const [alertStalled, setAlertStalled] = useState<AlertActivity[]>([]);
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    if (!propUserId) return;

    const init = async () => {
      // Get user email for display
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || '');

      const uid = propUserId;
      let tid = propTeamId || '';

      // If no team assigned, super_admin can fallback to first available team
      if (!tid) {
        const { data: teams } = await supabase
          .from('teams')
          .select('id, name')
          .order('created_at', { ascending: true })
          .limit(1);
        if (teams && teams.length > 0) tid = teams[0].id;
      }

      if (!tid) return;

      // Load team name
      const { data: teamRow } = await supabase
        .from('teams')
        .select('id, name')
        .eq('id', tid)
        .maybeSingle();

      if (!teamRow) return;

      setTeamName(teamRow.name);
      setSelectedTeam(teamRow.id);

      const [reviewResult, memberResult] = await Promise.all([
        supabase
          .from('activities')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', tid)
          .eq('status', 'IN_REVIEW'),
        supabase
          .from('team_members')
          .select('id, name')
          .eq('team_id', tid)
          .eq('user_id', uid)
          .maybeSingle(),
      ]);

      setPendingReviewCount(reviewResult.count ?? 0);

      if (memberResult.data) {
        setManagerMemberId(memberResult.data.id);
        setManagerName(memberResult.data.name ?? '');
      } else if (user) {
        // Create team_member row automatically if missing
        const displayName = user.email?.split('@')[0] ?? 'Gestor';
        const { data: created } = await supabase
          .from('team_members')
          .insert({ team_id: tid, user_id: uid, name: displayName, email: user.email ?? '', position: 'Gestor' })
          .select('id, name')
          .maybeSingle();
        if (created) {
          setManagerMemberId(created.id);
          setManagerName(created.name ?? '');
        }
      }

      await loadAlerts(tid);
    };

    init();
  }, [propUserId, propTeamId]);

  const loadAlerts = async (tid: string) => {
    const todayIso = new Date().toISOString().split('T')[0];
    const twoDaysLater = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();

    // Load all non-terminal activities with member info
    const { data: acts } = await supabase
      .from('activities')
      .select('id, title, status, priority, end_date, project, team_member_id, updated_at')
      .eq('team_id', tid)
      .in('status', ['PENDING', 'IN_PROGRESS'])
      .order('end_date', { ascending: true, nullsFirst: false });

    if (!acts || acts.length === 0) return;

    // Load member names
    const memberIds = [...new Set(acts.map((a: any) => a.team_member_id).filter(Boolean))];
    const { data: members } = await supabase
      .from('team_members')
      .select('id, name')
      .in('id', memberIds);

    const nameMap: Record<string, string> = {};
    (members || []).forEach((m: any) => { nameMap[m.id] = m.name; });

    // Load last revision comment for each activity
    const activityIds = acts.map((a: any) => a.id);
    const { data: revisions } = await supabase
      .from('activity_revisions')
      .select('activity_id, comments, created_at')
      .in('activity_id', activityIds)
      .order('created_at', { ascending: false });

    const lastRevMap: Record<string, { comments: string; created_at: string }> = {};
    (revisions || []).forEach((r: any) => {
      if (!lastRevMap[r.activity_id]) lastRevMap[r.activity_id] = r;
    });

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const toAlert = (a: any): AlertActivity => {
      const due = a.end_date ? new Date(a.end_date + 'T00:00:00') : null;
      const diffDays = due ? Math.floor((due.getTime() - today.getTime()) / 86400000) : null;
      const rev = lastRevMap[a.id];
      return {
        id: a.id,
        title: a.title,
        status: a.status,
        priority: a.priority,
        end_date: a.end_date,
        project: a.project,
        member_name: nameMap[a.team_member_id] ?? 'Sin asignar',
        days_overdue: diffDays ?? undefined,
        last_comment: rev?.comments,
        last_comment_date: rev?.created_at,
      };
    };

    const overdue = acts
      .filter((a: any) => {
        if (!a.end_date) return false;
        const due = new Date(a.end_date + 'T00:00:00');
        return due < today;
      })
      .map(toAlert);

    const dueSoon = acts
      .filter((a: any) => {
        if (!a.end_date) return false;
        const due = new Date(a.end_date + 'T00:00:00');
        const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
        return diff >= 0 && diff <= 2;
      })
      .map(toAlert);

    const stalled = acts
      .filter((a: any) => {
        // IN_PROGRESS but not updated in 3+ days and not overdue/due-soon
        if (a.status !== 'IN_PROGRESS') return false;
        const updatedAt = new Date(a.updated_at);
        const stalledThreshold = new Date(Date.now() - 3 * 86400000);
        const isRecentlyDue = a.end_date && (() => {
          const due = new Date(a.end_date + 'T00:00:00');
          const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
          return diff < 0 || diff <= 2;
        })();
        return updatedAt < stalledThreshold && !isRecentlyDue;
      })
      .map(toAlert);

    setAlertOverdue(overdue);
    setAlertDueSoon(dueSoon);
    setAlertStalled(stalled);

    if (overdue.length + dueSoon.length + stalled.length > 0) {
      setShowAlert(true);
    }
  };


  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleNotifNavigate = (target: NotifNavTarget) => {
    if (target.section === 'activities') {
      setActiveSection('activities');
      if (target.activityId) setPendingActivityId(target.activityId);
    } else if (target.section === 'review') {
      setActiveSection('review');
      if (target.activityId) setPendingActivityId(target.activityId);
    } else if (target.section === 'changelog') {
      setActiveSection('changelog');
    } else if (target.section === 'documentation') {
      setActiveSection('documentation');
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0b0e18' }}>
      <Navbar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        userEmail={userEmail}
        onLogout={handleLogout}
        pendingReviewCount={pendingReviewCount}
        managerMemberId={managerMemberId}
        teamName={teamName}
        isSuperAdmin={isSuperAdmin}
        onNotifNavigate={handleNotifNavigate}
        onSwitchToSupervisor={onSwitchToSupervisor}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} pendingReviewCount={pendingReviewCount} isSuperAdmin={isSuperAdmin} />

        <main className="flex-1 overflow-y-auto" style={{ background: 'linear-gradient(160deg,#0a0e19 0%,#080c15 100%)' }}>
          <div className="p-6">
            {selectedTeam ? (
              <>
                {activeSection === 'collaborators' && <CollaboratorsSection teamId={selectedTeam} />}
                {activeSection === 'activities' && <ActivitiesSection teamId={selectedTeam} pendingActivityId={pendingActivityId} onPendingClear={() => setPendingActivityId(null)} managerMemberId={managerMemberId} managerName={managerName} onNavigateToChangelog={(entryId) => { setPendingChangelogEntryId(entryId); setActiveSection('changelog'); }} />}
                {activeSection === 'review' && <ReviewSection teamId={selectedTeam} pendingActivityId={pendingActivityId} onPendingClear={() => setPendingActivityId(null)} />}
                {activeSection === 'calendar' && <CalendarSection teamId={selectedTeam} managerMemberId={managerMemberId} />}
                {activeSection === 'projects' && <ProjectsSection teamId={selectedTeam} userId={propUserId} />}
                {activeSection === 'changelog' && <ChangelogManagerSection teamId={selectedTeam} pendingEntryId={pendingChangelogEntryId} onPendingClear={() => setPendingChangelogEntryId(null)} />}
                {activeSection === 'documentation' && <DocumentationSection teamId={selectedTeam} isManager={true} />}
                {activeSection === 'utilities' && <UtilitiesSection teamId={selectedTeam} authorName={managerName} canEdit={true} />}
                {activeSection === 'audit' && <AuditLogSection teamId={selectedTeam} />}
                {activeSection === 'settings' && <SettingsSection userEmail={userEmail} />}
                {activeSection === 'permissions' && <PermissionsSection teamId={selectedTeam} />}
                {activeSection === 'admin' && isSuperAdmin && (
                  <SuperAdminPanel userEmail={userEmail} onLogout={handleLogout} embedded />
                )}
              </>
            ) : (
              isSuperAdmin ? (
                <SuperAdminPanel userEmail={userEmail} onLogout={handleLogout} embedded />
              ) :
              <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Sin equipo asignado</h2>
                <p className="text-slate-400 mb-2">Contacta al administrador para que te asigne un equipo.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {showAlert && (alertOverdue.length + alertDueSoon.length + alertStalled.length > 0) && (
        <ManagerAlertModal
          overdue={alertOverdue}
          dueSoon={alertDueSoon}
          stalled={alertStalled}
          onClose={() => setShowAlert(false)}
          onGoToCollaborator={() => { setShowAlert(false); setActiveSection('activities'); }}
        />
      )}
    </div>
  );
}

