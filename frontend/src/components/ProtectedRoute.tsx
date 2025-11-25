import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from './AuthProvider'
import { Dock, DockIcon, DockItem, DockLabel } from './ui/dock'
import { PlayfulTodoList } from './ui/playful-todolist'
import { MusicCard } from './ui/music-card'
import {
  LayoutDashboard,
  Users,
  Mail,
  FileText,
  Settings,
  Briefcase,
  Video,
  LogOut,
  CheckCircle2,
  Music,
  X,
} from 'lucide-react'

const dockLinks = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Lead Generation', href: '/hybrid', icon: Users },
  { label: 'Email Outreach', href: '/outreach', icon: Mail },
  { label: 'CV Generator', href: '/cv', icon: FileText },
  { label: 'B2B Documents', href: '/b2b', icon: Briefcase },
  { label: 'AI Avatar Practice', href: '/avatar', icon: Video },
  { label: 'Settings', href: '/settings', icon: Settings },
]

export default function ProtectedRoute() {
  const { authed, logout } = useAuth()
  const loc = useLocation()
  const [activePanel, setActivePanel] = useState<'todo' | 'music' | null>(null)
  const todoPanelRef = useRef<HTMLDivElement>(null)
  const musicPanelRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  
  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      
      // Don't close if clicking on the dock
      if (dockRef.current?.contains(target)) {
        return
      }
      
      // Close if clicking outside both panels
      const isClickInTodoPanel = todoPanelRef.current?.contains(target)
      const isClickInMusicPanel = musicPanelRef.current?.contains(target)
      
      if (!isClickInTodoPanel && !isClickInMusicPanel && activePanel) {
        setActivePanel(null)
      }
    }

    if (activePanel) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [activePanel])
  
  if (!authed) return <Navigate to="/login" replace state={{ from: loc.pathname }} />

  return (
    <div className="relative min-h-screen w-full bg-black text-white">
      {/* Floating Panels - Above Dock */}
      <AnimatePresence>
        {activePanel === 'todo' && (
          <motion.div
            ref={todoPanelRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-32 left-1/2 z-40 -translate-x-1/2 w-80 max-w-[90vw] max-h-[60vh] pointer-events-auto"
          >
            <div className="rounded-xl bg-black/95 backdrop-blur-sm border border-white/10 shadow-2xl p-5 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-white font-semibold text-sm">Tasks</h3>
                </div>
                <button
                  onClick={() => setActivePanel(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                <PlayfulTodoList
                  items={[
                    {
                      id: 1,
                      label: 'Complete lead generation run 🎯',
                      defaultChecked: false,
                    },
                    {
                      id: 2,
                      label: 'Review email templates 📧',
                      defaultChecked: false,
                    },
                    {
                      id: 3,
                      label: 'Update CV documents 📄',
                      defaultChecked: false,
                    },
                  ]}
                />
              </div>
            </div>
          </motion.div>
        )}

        {activePanel === 'music' && (
          <motion.div
            ref={musicPanelRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed bottom-32 left-1/2 z-40 -translate-x-1/2 w-80 max-w-[90vw] max-h-[60vh] pointer-events-auto"
          >
            <div className="rounded-xl bg-black/95 backdrop-blur-sm border border-white/10 shadow-2xl p-5 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                    <Music className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-white font-semibold text-sm">Music</h3>
                </div>
                <button
                  onClick={() => setActivePanel(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar flex items-center justify-center p-4">
                <MusicCard 
                  src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
                  poster="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop"
                  title="Relaxing Music"
                  artist="Chill Beats"
                  mainColor="#3b82f6"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={loc.pathname}
          className="min-h-screen w-full overflow-auto pb-36"
          initial={{ opacity: 0 }}
          animate={{ 
            opacity: 1, 
            transition: { 
              duration: 0.15, 
              ease: 'easeOut',
            },
          }}
          exit={{ 
            opacity: 0, 
            transition: { 
              duration: 0.1, 
              ease: 'easeIn',
            },
          }}
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>

      <div ref={dockRef} className="pointer-events-none fixed bottom-8 left-1/2 z-50 w-full max-w-5xl -translate-x-1/2 px-6">
        <Dock className="pointer-events-auto items-end pb-4">
          {dockLinks.map(({ label, href, icon: Icon }) => (
            <DockItem
              key={href}
              className="aspect-square rounded-[1.9rem] border border-black/10 bg-black/85 shadow-[0_18px_40px_-25px_rgba(0,0,0,0.7)] backdrop-blur-sm transition-transform duration-300 dark:border-white/15 dark:bg-white/12"
            >
              <DockLabel className="!border-white/20 !bg-white/95 !text-neutral-900 dark:!border-white/10 dark:!bg-neutral-950 dark:!text-white">
                {label}
              </DockLabel>
              <DockIcon>
                <Link
                  to={href}
                  className="flex h-full w-full items-center justify-center text-white dark:text-neutral-100"
                >
                  <Icon className="h-full w-full" />
                </Link>
              </DockIcon>
            </DockItem>
          ))}
          {/* Todo List */}
          <DockItem 
            className={`aspect-square rounded-[1.9rem] border border-black/10 bg-black/85 shadow-[0_18px_40px_-25px_rgba(0,0,0,0.7)] backdrop-blur-sm transition-transform duration-300 dark:border-white/15 dark:bg-white/12 ${activePanel === 'todo' ? 'ring-2 ring-white/30' : ''}`}
          >
            <DockLabel className="!border-white/20 !bg-white/95 !text-neutral-900 dark:!border-white/10 dark:!bg-neutral-950 dark:!text-white">
              Tasks
            </DockLabel>
            <DockIcon>
              <button
                onClick={() => setActivePanel(activePanel === 'todo' ? null : 'todo')}
                className="flex h-full w-full items-center justify-center text-white transition-colors hover:text-neutral-200 dark:text-neutral-100"
              >
                <CheckCircle2 className="h-[70%] w-[70%] min-h-[20px] min-w-[20px]" />
              </button>
            </DockIcon>
          </DockItem>
          {/* Music Player */}
          <DockItem 
            className={`aspect-square rounded-[1.9rem] border border-black/10 bg-black/85 shadow-[0_18px_40px_-25px_rgba(0,0,0,0.7)] backdrop-blur-sm transition-transform duration-300 dark:border-white/15 dark:bg-white/12 ${activePanel === 'music' ? 'ring-2 ring-white/30' : ''}`}
          >
            <DockLabel className="!border-white/20 !bg-white/95 !text-neutral-900 dark:!border-white/10 dark:!bg-neutral-950 dark:!text-white">
              Music
            </DockLabel>
            <DockIcon>
              <button
                onClick={() => setActivePanel(activePanel === 'music' ? null : 'music')}
                className="flex h-full w-full items-center justify-center text-white transition-colors hover:text-neutral-200 dark:text-neutral-100"
              >
                <Music className="h-[70%] w-[70%] min-h-[20px] min-w-[20px]" />
              </button>
            </DockIcon>
          </DockItem>
          {/* Logout */}
          <DockItem className="aspect-square rounded-[1.9rem] border border-black/10 bg-black/85 shadow-[0_18px_40px_-25px_rgba(0,0,0,0.7)] backdrop-blur-sm transition-transform duration-300 dark:border-white/15 dark:bg-white/12">
            <DockLabel className="!border-white/20 !bg-white/95 !text-neutral-900 dark:!border-white/10 dark:!bg-neutral-950 dark:!text-white">
              Logout
            </DockLabel>
            <DockIcon>
              <button
                onClick={logout}
                className="flex h-full w-full items-center justify-center text-white transition-colors hover:text-neutral-200 dark:text-neutral-100"
              >
                <LogOut className="h-[70%] w-[70%] min-h-[20px] min-w-[20px]" />
              </button>
            </DockIcon>
          </DockItem>
        </Dock>
      </div>
    </div>
  )
}
