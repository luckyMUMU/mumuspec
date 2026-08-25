/**
 * SideNav — role selection + onboard progress indicator.
 */

import { useDashboardStore } from '@/store/useDashboardStore';
import styles from './SideNav.module.css';

const ROLES = [
  { id: 'new-member' as const, label: '新成员' },
  { id: 'lead' as const, label: 'Tech Lead' },
  { id: 'solo' as const, label: '单人开发者' },
];

export function SideNav() {
  const role = useDashboardStore((s) => s.role);
  const setRole = useDashboardStore((s) => s.setRole);

  return (
    <nav className={styles.sidenav} data-testid="sidenav">
      <div className={styles.section}>角色</div>
      {ROLES.map((r) => (
        <button
          key={r.id}
          className={styles.roleBtn}
          data-active={role === r.id}
          onClick={() => setRole(r.id)}
          data-testid={`role-${r.id}`}
        >
          {r.label}
        </button>
      ))}
      {role && (
        <div className={styles.progress} data-testid="role-progress">
          当前角色: {role}
        </div>
      )}
    </nav>
  );
}
