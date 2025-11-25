import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export interface UserProfile {
  email: string
  name?: string
  phone?: string
  company?: string
  position?: string
  bio?: string
  meetingLink?: string
  websiteUrl?: string
  linkedinUrl?: string
  preferences?: {
    theme?: 'light' | 'dark' | 'auto'
    notifications?: boolean
    language?: string
  }
  emailSettings?: {
    sendProvider?: 'gmail' | 'smtp'
    smtpHost?: string
    smtpPort?: number
    smtpSecure?: boolean
    smtpUser?: string
    smtpPass?: string
  }
  updatedAt?: number
}

type AuthCtx = { 
  authed: boolean
  user: UserProfile | null
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>
  signup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>
  getProfile: () => UserProfile | null
}

const Ctx = createContext<AuthCtx | undefined>(undefined)

// Simple user storage (in production, use backend API)
const USERS_STORAGE_KEY = 'leadforge_users'
const SESSION_STORAGE_KEY = 'leadforge_session'
const REMEMBER_ME_KEY = 'leadforge_remember_me'

interface StoredUser {
  email: string
  passwordHash: string // In production, never store passwords. Use proper hashing.
  createdAt: number
  profile?: UserProfile
}

// Simple hash function (in production, use proper bcrypt/argon2)
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString()
}

function getStoredUsers(): Map<string, StoredUser> {
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY)
    if (!stored) return new Map()
    const users = JSON.parse(stored)
    return new Map(Object.entries(users))
  } catch {
    return new Map()
  }
}

function saveStoredUsers(users: Map<string, StoredUser>) {
  try {
    const obj = Object.fromEntries(users)
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(obj))
  } catch (e) {
    console.error('Failed to save users:', e)
  }
}

// Load user profile from storage
function loadUserProfile(email: string): UserProfile {
  try {
    const users = getStoredUsers()
    const user = users.get(email.toLowerCase())
    if (user?.profile) {
      return { ...user.profile, email: user.email }
    }
    return { email: email.toLowerCase() }
  } catch {
    return { email: email.toLowerCase() }
  }
}

// Save user profile to storage
function saveUserProfile(email: string, profile: Partial<UserProfile>) {
  try {
    const users = getStoredUsers()
    const user = users.get(email.toLowerCase())
    if (user) {
      user.profile = {
        ...user.profile,
        ...profile,
        email: email.toLowerCase(),
        updatedAt: Date.now()
      }
      users.set(email.toLowerCase(), user)
      saveStoredUsers(users)
    }
  } catch (e) {
    console.error('Failed to save profile:', e)
  }
}

// Initialize auth state from storage synchronously
function initializeAuthState(): { authed: boolean; user: UserProfile | null } {
  try {
    // Check remember me first (persistent, survives browser restart)
    const rememberMe = localStorage.getItem(REMEMBER_ME_KEY)
    if (rememberMe) {
      const rememberData = JSON.parse(rememberMe)
      const profile = loadUserProfile(rememberData.email)
      return { authed: true, user: profile }
    }

    // Check session storage (temporary, survives page reload)
    const session = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (session) {
      const sessionData = JSON.parse(session)
      const profile = loadUserProfile(sessionData.email)
      return { authed: true, user: profile }
    }

    // Also check localStorage for session (backup)
    const localStorageSession = localStorage.getItem(SESSION_STORAGE_KEY)
    if (localStorageSession) {
      const sessionData = JSON.parse(localStorageSession)
      const profile = loadUserProfile(sessionData.email)
      // Restore to sessionStorage as well
      sessionStorage.setItem(SESSION_STORAGE_KEY, localStorageSession)
      return { authed: true, user: profile }
    }
  } catch (e) {
    console.error('Failed to load session:', e)
  }
  return { authed: false, user: null }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize auth state synchronously from storage
  const initialState = initializeAuthState()
  const [authed, setAuthed] = useState(initialState.authed)
  const [user, setUser] = useState<UserProfile | null>(initialState.user)

  // Also check on mount in case storage was updated in another tab
  useEffect(() => {
    const checkSession = () => {
    try {
        // Check remember me first (persistent, survives browser restart)
        const rememberMe = localStorage.getItem(REMEMBER_ME_KEY)
        if (rememberMe) {
          const rememberData = JSON.parse(rememberMe)
          const profile = loadUserProfile(rememberData.email)
          setAuthed(true)
          setUser(profile)
          return
        }

        // Check session storage (temporary, survives page reload)
      const session = sessionStorage.getItem(SESSION_STORAGE_KEY)
      if (session) {
        const sessionData = JSON.parse(session)
        const profile = loadUserProfile(sessionData.email)
        setAuthed(true)
        setUser(profile)
        return
      }

        // Also check localStorage for session (backup)
        const localStorageSession = localStorage.getItem(SESSION_STORAGE_KEY)
        if (localStorageSession) {
          const sessionData = JSON.parse(localStorageSession)
          const profile = loadUserProfile(sessionData.email)
          // Restore to sessionStorage as well
          sessionStorage.setItem(SESSION_STORAGE_KEY, localStorageSession)
        setAuthed(true)
        setUser(profile)
          return
        }

        // If we were authed but storage is gone, clear auth
        if (authed) {
          setAuthed(false)
          setUser(null)
      }
    } catch (e) {
      console.error('Failed to load session:', e)
    }
    }

    checkSession()

    // Listen for storage changes (e.g., from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SESSION_STORAGE_KEY || e.key === REMEMBER_ME_KEY) {
        checkSession()
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [authed])

  const value = useMemo<AuthCtx>(() => ({
    authed,
    user,
    async login(email: string, password: string, rememberMe = false) {
      try {
        if (!email || !password) {
          return { success: false, error: 'Email and password are required' }
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
          return { success: false, error: 'Please enter a valid email address' }
        }

        // Validate password length
        if (password.length < 6) {
          return { success: false, error: 'Password must be at least 6 characters' }
        }

        const users = getStoredUsers()
        const user = users.get(email.toLowerCase())
        const passwordHash = simpleHash(password)

        if (!user) {
          return { success: false, error: 'Invalid email or password' }
        }

        if (user.passwordHash !== passwordHash) {
          return { success: false, error: 'Invalid email or password' }
        }

        // Load user profile
        const profile = loadUserProfile(user.email)

        // Set authentication
        setAuthed(true)
        setUser(profile)

        // Store session - always use localStorage for persistence across reloads
        // Use sessionStorage as backup for remember me preference
        if (rememberMe) {
          // Store in localStorage for persistent login (survives browser restart)
          localStorage.setItem(REMEMBER_ME_KEY, JSON.stringify({ email: user.email, timestamp: Date.now() }))
          // Also store in sessionStorage as backup
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ email: user.email, timestamp: Date.now() }))
        } else {
          // Store in both for persistence across page reloads (but not browser restart)
          sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ email: user.email, timestamp: Date.now() }))
          // Also store in localStorage temporarily (will be cleared on logout)
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ email: user.email, timestamp: Date.now() }))
        }

        return { success: true }
      } catch (error) {
        console.error('Login error:', error)
        return { success: false, error: 'An error occurred during login' }
      }
    },
    async signup(email: string, password: string) {
      try {
        if (!email || !password) {
          return { success: false, error: 'Email and password are required' }
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
          return { success: false, error: 'Please enter a valid email address' }
        }

        // Validate password length
        if (password.length < 6) {
          return { success: false, error: 'Password must be at least 6 characters' }
        }

        const users = getStoredUsers()
        const emailLower = email.toLowerCase()

        // Check if user already exists
        if (users.has(emailLower)) {
          return { success: false, error: 'An account with this email already exists' }
        }

        // Create new user
        const newUser: StoredUser = {
          email: emailLower,
          passwordHash: simpleHash(password),
          createdAt: Date.now()
        }

        users.set(emailLower, newUser)
        saveStoredUsers(users)

        // Create initial profile
        const initialProfile: UserProfile = {
          email: emailLower,
          preferences: {
            theme: 'dark',
            notifications: true,
            language: 'en'
          },
          updatedAt: Date.now()
        }
        saveUserProfile(emailLower, initialProfile)

        // Auto-login after signup
        setAuthed(true)
        setUser(initialProfile)
        // Store in both for persistence across page reloads
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ email: emailLower, timestamp: Date.now() }))
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ email: emailLower, timestamp: Date.now() }))

        return { success: true }
      } catch (error) {
        console.error('Signup error:', error)
        return { success: false, error: 'An error occurred during signup' }
      }
    },
    async forgotPassword(email: string) {
      try {
        if (!email) {
          return { success: false, error: 'Email is required' }
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
          return { success: false, error: 'Please enter a valid email address' }
        }

        const users = getStoredUsers()
        const emailLower = email.toLowerCase()

        if (!users.has(emailLower)) {
          // Don't reveal if email exists (security best practice)
          // But for UX, we'll show success anyway
          return { success: true }
        }

        // In production, send password reset email here
        // For now, we'll just return success
        // You can implement email sending logic here
        
        return { success: true }
      } catch (error) {
        console.error('Forgot password error:', error)
        return { success: false, error: 'An error occurred. Please try again.' }
      }
    },
    logout() {
      setAuthed(false)
      setUser(null)
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
      localStorage.removeItem(REMEMBER_ME_KEY)
      localStorage.removeItem(SESSION_STORAGE_KEY)
    },
    async updateProfile(updates: Partial<UserProfile>) {
      try {
        if (!user) {
          return { success: false, error: 'Not authenticated' }
        }

        // Save profile updates
        saveUserProfile(user.email, updates)

        // Update current user state
        const updatedProfile: UserProfile = {
          ...user,
          ...updates,
          email: user.email, // Ensure email doesn't change
          updatedAt: Date.now()
        }
        setUser(updatedProfile)

        return { success: true }
      } catch (error) {
        console.error('Update profile error:', error)
        return { success: false, error: 'Failed to update profile' }
      }
    },
    getProfile() {
      return user
    },
  }), [authed, user])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() { 
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be in AuthProvider')
  return v 
}
