import React from 'react'
import ReactDOM from 'react-dom/client'
import './style.css'
import { ThemeProvider } from './components/ThemeProvider'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './components/AuthProvider'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import HybridPage from './pages/HybridPage'
import OutreachPage from './pages/OutreachPage'
import CVPage from './pages/CVPage'
import B2BPage from './pages/B2BPage'
import SettingsPage from './pages/SettingsPage'
import AvatarChatPage from './pages/AvatarChatPage'
import { AnimatePresence, motion, MotionConfig } from 'framer-motion'
import { PageBackground } from './components/PageBackground'
import { MagneticCursor } from './components/ui/magnetic-cursor'

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
      exit={{ opacity: 0, x: -100, transition: { duration: 0.3, ease: 'easeInOut' } }}
      style={{ minHeight: '100%', width: '100%' }}
    >
      {children}
    </motion.div>
  )
}

function AnimatedAppRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route element={<ProtectedRoute />}> 
          <Route path="/dashboard" element={<PageTransition><PageBackground><Dashboard /></PageBackground></PageTransition>} />
          <Route path="/hybrid" element={<PageTransition><PageBackground><HybridPage /></PageBackground></PageTransition>} />
          <Route path="/outreach" element={<PageTransition><PageBackground><OutreachPage /></PageBackground></PageTransition>} />
          <Route path="/cv" element={<PageTransition><PageBackground><CVPage /></PageBackground></PageTransition>} />
          <Route path="/b2b" element={<PageTransition><PageBackground><B2BPage /></PageBackground></PageTransition>} />
          <Route path="/avatar" element={<PageTransition><PageBackground><AvatarChatPage /></PageBackground></PageTransition>} />
          <Route path="/settings" element={<PageTransition><PageBackground><SettingsPage /></PageBackground></PageTransition>} />
        </Route>
        <Route path="*" element={<PageTransition><Landing /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  )
}

ReactDOM.createRoot(document.getElementById('app') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <MotionConfig reducedMotion="never">
          <MagneticCursor>
            <BrowserRouter>
              <AnimatedAppRoutes />
            </BrowserRouter>
          </MagneticCursor>
        </MotionConfig>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
)
