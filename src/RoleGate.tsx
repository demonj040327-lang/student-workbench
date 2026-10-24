
import { useState } from 'react';
import CampusApp from './CampusApp';
import Login, { type UserRole } from './Login';

const STORAGE_KEY = 'workbench-demo-role';

function getSavedRole(): UserRole | null {
  const value = sessionStorage.getItem(STORAGE_KEY);

  if (value !== 'teacher' && value !== 'student') {
    return null;
  }

  const url = new URL(window.location.href);
  url.searchParams.set('role', value);
  window.history.replaceState(null, '', url);

  return value;
}

export default function RoleGate() {
  const [role, setRole] = useState<UserRole | null>(
    getSavedRole
  );

  function handleLogin(nextRole: UserRole) {
    sessionStorage.setItem(STORAGE_KEY, nextRole);

    const url = new URL(window.location.href);
    url.searchParams.set('role', nextRole);
    url.searchParams.delete('view');

    window.history.replaceState(null, '', url);
    setRole(nextRole);
  }

  function handleLogout() {
    sessionStorage.removeItem(STORAGE_KEY);

    const url = new URL(window.location.href);
    url.searchParams.delete('role');
    url.searchParams.delete('view');

    window.history.replaceState(null, '', url);
    setRole(null);
  }

  if (!role) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <CampusApp
        key={role}
        onLogout={handleLogout}
    />
  );
}
