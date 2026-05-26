import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import CollaboratorLoginPage from './pages/CollaboratorLoginPage';
import CollaboratorView from './pages/CollaboratorView';
import SupervisorDashboard from './pages/SupervisorDashboard';

type AppMode = 'loading' | 'collaborator-login' | 'collaborator-view' | 'manager-login' | 'manager-dashboard' | 'viewer-dashboard' | 'manager-supervisor-view';

interface CollaboratorSession {
  id: string;
  name: string;
  email: string;
  position: string;
}

const COLLAB_SESSION_KEY = 'collab_session';

function App() {
  const [mode, setMode] = useState<AppMode>('loading');
  const [collabSession, setCollabSession] = useState<CollaboratorSession | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [hasViewerGrants, setHasViewerGrants] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_OUT') {
          setIsSuperAdmin(false);
          setHasViewerGrants(false);
          setTeamId(null);
          setUserId('');
          setUserEmail('');
          // Check for collab session
          const saved = sessionStorage.getItem(COLLAB_SESSION_KEY);
          setMode(saved ? 'collaborator-view' : 'collaborator-login');
          return;
        }

        if (session?.user) {
          const uid = session.user.id;
          setUserEmail(session.user.email || '');
          setUserId(uid);

          // Retry up to 5 times to handle RLS token propagation delay
          let roleRow: { role: string; team_id: string | null } | null = null;
          for (let attempt = 0; attempt < 5; attempt++) {
            const { data, error } = await supabase
              .from('app_roles')
              .select('role, team_id')
              .eq('user_id', uid)
              .maybeSingle();
            console.log(`[App] attempt ${attempt + 1} role query:`, { data, error, uid });
            if (data) { roleRow = data; break; }
            await new Promise(r => setTimeout(r, 800));
          }

          console.log('[App] final roleRow:', roleRow);

          if (roleRow?.role === 'viewer') {
            setIsSuperAdmin(false);
            setHasViewerGrants(false);
            setTeamId(null);
            setMode('viewer-dashboard');
            return;
          }

          const isAdmin = roleRow?.role === 'super_admin';
          setIsSuperAdmin(isAdmin);
          setTeamId(roleRow?.team_id ?? null);
          console.log('[App] setIsSuperAdmin:', isAdmin, 'setTeamId:', roleRow?.team_id);

          const { count } = await supabase
            .from('viewer_grants')
            .select('id', { count: 'exact', head: true })
            .eq('viewer_user_id', uid);
          setHasViewerGrants((count ?? 0) > 0);
          setMode('manager-dashboard');
          return;
        }

        // No auth session — check collab session
        const saved = sessionStorage.getItem(COLLAB_SESSION_KEY);
        if (saved) {
          try {
            const parsed: CollaboratorSession = JSON.parse(saved);
            const { data: members } = await supabase
              .from('team_members')
              .select('id, name, email, position')
              .ilike('email', parsed.email.trim());
            if (members && members.length > 0) {
              const fresh = { id: members[0].id, name: members[0].name, email: members[0].email, position: members[0].position ?? '' };
              sessionStorage.setItem(COLLAB_SESSION_KEY, JSON.stringify(fresh));
              setCollabSession(fresh);
              setMode('collaborator-view');
              return;
            }
          } catch { /* fall through */ }
          sessionStorage.removeItem(COLLAB_SESSION_KEY);
        }
        setMode('collaborator-login');
      })();
    });

    return () => subscription?.unsubscribe();
  }, []);

  const handleCollaboratorFound = (member: { id: string; name: string; email: string; position: string }) => {
    sessionStorage.setItem(COLLAB_SESSION_KEY, JSON.stringify(member));
    setCollabSession(member);
    setMode('collaborator-view');
  };

  const handleCollaboratorLogout = () => {
    sessionStorage.removeItem(COLLAB_SESSION_KEY);
    setCollabSession(null);
    setMode('collaborator-login');
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Session already invalid — clear local storage manually
    }
    // Always clear local auth state regardless of server response
    localStorage.removeItem('sb-iigwqlvglxteqercunkx-auth-token');
    sessionStorage.clear();
    setIsSuperAdmin(false);
    setHasViewerGrants(false);
    setTeamId(null);
    setUserId('');
    setUserEmail('');
    setMode('collaborator-login');
  };

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (mode === 'collaborator-login') {
    return (
      <CollaboratorLoginPage
        onCollaboratorFound={handleCollaboratorFound}
        onSwitchToManager={() => setMode('manager-login')}
      />
    );
  }

  if (mode === 'collaborator-view' && collabSession) {
    return (
      <CollaboratorView
        memberId={collabSession.id}
        memberName={collabSession.name}
        memberEmail={collabSession.email}
        memberPosition={collabSession.position}
        onLogout={handleCollaboratorLogout}
      />
    );
  }

  if (mode === 'manager-login') {
    return <AuthPage onSwitchToCollaborator={() => setMode('collaborator-login')} />;
  }

  if (mode === 'viewer-dashboard' || mode === 'manager-supervisor-view') {
    return (
      <SupervisorDashboard
        userEmail={userEmail}
        onLogout={handleLogout}
        onSwitchToManager={mode === 'manager-supervisor-view' ? () => setMode('manager-dashboard') : undefined}
      />
    );
  }

  return (
    <Dashboard
      isSuperAdmin={isSuperAdmin}
      userId={userId}
      assignedTeamId={teamId}
      hasViewerGrants={hasViewerGrants}
      onSwitchToSupervisor={hasViewerGrants ? () => setMode('manager-supervisor-view') : undefined}
    />
  );
}

export default App;
