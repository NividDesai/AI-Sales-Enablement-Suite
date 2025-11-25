import { NavLink } from 'react-router-dom'
import { MotionButton } from './MotionButton'
import { useAuth } from './AuthProvider'

export default function Sidebar() {
  const { logout } = useAuth()
  return (
    <aside style={{ borderRight: '1px solid var(--border)', padding: 16, background: 'var(--card)', minHeight: '100vh' }}>
      <div style={{ fontWeight: 800, marginBottom: 12 }}>Dashboard</div>
      <nav style={{ display: 'grid', gap: 8 }}>
        <NavLink to="/hybrid"><MotionButton style={{ width: '100%' }}>Hybrid Lead Generation</MotionButton></NavLink>
        <NavLink to="/outreach"><MotionButton style={{ width: '100%' }}>Email Outreach</MotionButton></NavLink>
        <NavLink to="/cv-b2b"><MotionButton style={{ width: '100%' }}>CV Builder & B2B Documents</MotionButton></NavLink>
        <NavLink to="/settings"><MotionButton style={{ width: '100%' }}>Settings</MotionButton></NavLink>
      </nav>
      <div style={{ marginTop: 16 }}>
        <MotionButton onClick={logout} style={{ width: '100%' }}>Logout</MotionButton>
      </div>
    </aside>
  )
}
