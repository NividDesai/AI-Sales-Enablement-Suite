import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Button } from './button'
import { AtSign, Lock, Mail, X } from 'lucide-react'
import { Input } from './input'
import { useAuth } from '../AuthProvider'

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    color: `rgba(15,23,42,${0.1 + i * 0.03})`,
    width: 0.5 + i * 0.03,
  }))

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full text-slate-950 dark:text-white" viewBox="0 0 696 316" fill="none">
        <title>Background Paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke="currentColor"
            strokeWidth={path.width}
            strokeOpacity={0.1 + path.id * 0.03}
            initial={{ pathLength: 0.3, opacity: 0.6 }}
            animate={{ pathLength: 1, opacity: [0.3, 0.6, 0.3], pathOffset: [0, 1, 0] }}
            transition={{ duration: 30, repeat: Number.POSITIVE_INFINITY, repeatType: 'loop', ease: 'linear' }}
          />
        ))}
      </svg>
    </div>
  )
}

export function AuthPage() {
  const navigate = useNavigate()
  const { login, signup, forgotPassword } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('')
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [forgotPasswordSuccess, setForgotPasswordSuccess] = useState(false)

  // Load remembered email if exists
  React.useEffect(() => {
    try {
      const remembered = localStorage.getItem('leadforge_remember_me')
      if (remembered) {
        const data = JSON.parse(remembered)
        setEmail(data.email || '')
        setRememberMe(true)
      }
    } catch (e) {
      // Ignore errors
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    
    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }
    
    setLoading(true)
    try {
      const result = mode === 'login' 
        ? await login(email, password, rememberMe) 
        : await signup(email, password)
      
      if (result.success) {
        setSuccess(mode === 'login' ? 'Login successful!' : 'Account created successfully!')
        // Store email for remember me
        if (rememberMe && mode === 'login') {
          localStorage.setItem('leadforge_remember_me', JSON.stringify({ email, timestamp: Date.now() }))
        }
        setTimeout(() => {
          navigate('/dashboard')
        }, 500)
      } else {
        setError(result.error || 'Authentication failed')
      }
    } catch (error) {
      console.error('Auth failed:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setForgotPasswordSuccess(false)
    
    if (!forgotPasswordEmail) {
      setError('Please enter your email address')
      return
    }
    
    setForgotPasswordLoading(true)
    try {
      const result = await forgotPassword(forgotPasswordEmail)
      if (result.success) {
        setForgotPasswordSuccess(true)
        setSuccess('If an account exists with this email, a password reset link has been sent.')
      } else {
        setError(result.error || 'Failed to process password reset request')
      }
    } catch (error) {
      console.error('Forgot password error:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-white dark:bg-neutral-950">
      {/* Background Paths */}
      <div className="absolute inset-0">
        <FloatingPaths position={1} />
        <FloatingPaths position={-1} />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col justify-center p-4">
        <div aria-hidden className="absolute inset-0 isolate contain-strict -z-10 opacity-60">
          <div className="bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,--theme(--color-foreground/.06)_0,hsla(0,0%,55%,.02)_50%,--theme(--color-foreground/.01)_80%)] absolute top-0 right-0 h-320 w-140 -translate-y-87.5 rounded-full" />
          <div className="bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] absolute top-0 right-0 h-320 w-60 [translate:5%_-50%] rounded-full" />
          <div className="bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] absolute top-0 right-0 h-320 w-60 -translate-y-87.5 rounded-full" />
        </div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }} className="mx-auto space-y-4 sm:w-sm w-full max-w-md">
          <div className="flex flex-col space-y-1">
            <h1 className="font-heading text-2xl font-bold tracking-wide">{mode === 'login' ? 'Sign In' : 'Create Account'}</h1>
            <p className="text-muted-foreground text-base">{mode === 'login' ? 'Enter your email and password to continue' : 'Create your account with email and password'}</p>
          </div>
          
          {/* Error/Success Messages */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm"
              >
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 text-sm"
              >
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="relative h-max">
              <Input 
                placeholder="your.email@example.com" 
                className="peer ps-9" 
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                required
                autoComplete="email"
              />
              <div className="text-muted-foreground pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
                <AtSign className="size-4" aria-hidden="true" />
              </div>
            </div>
            <div className="relative h-max">
              <Input 
                placeholder="Password" 
                className="peer ps-9" 
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <div className="text-muted-foreground pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
                <Lock className="size-4" aria-hidden="true" />
              </div>
            </div>
            
            {/* Remember Me & Forgot Password (only for login) */}
            {mode === 'login' && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-input cursor-pointer"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-muted-foreground hover:text-primary underline underline-offset-4"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading} size="lg">
              <span>{loading ? (mode === 'login' ? 'Signing in...' : 'Creating...') : (mode === 'login' ? 'Sign In' : 'Create Account')}</span>
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              {mode === 'login' ? (
                <span>
                  Don't have an account?{' '}
                  <button type="button" className="underline underline-offset-4 hover:text-primary" onClick={() => {
                    setMode('signup')
                    setError(null)
                    setSuccess(null)
                  }}>Create one</button>
                </span>
              ) : (
                <span>
                  Already have an account?{' '}
                  <button type="button" className="underline underline-offset-4 hover:text-primary" onClick={() => {
                    setMode('login')
                    setError(null)
                    setSuccess(null)
                  }}>Sign in</button>
                </span>
              )}
            </div>
          </form>

          {/* Forgot Password Modal */}
          <AnimatePresence>
            {showForgotPassword && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                  onClick={() => {
                    setShowForgotPassword(false)
                    setForgotPasswordEmail('')
                    setError(null)
                    setForgotPasswordSuccess(false)
                  }}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md p-6 bg-white dark:bg-neutral-900 rounded-lg border border-slate-200 dark:border-neutral-800 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Reset Password</h2>
                    <button
                      onClick={() => {
                        setShowForgotPassword(false)
                        setForgotPasswordEmail('')
                        setError(null)
                        setForgotPasswordSuccess(false)
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                  
                  {forgotPasswordSuccess ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 text-sm">
                        <p className="font-semibold mb-2">Check your email</p>
                        <p>If an account exists with <strong>{forgotPasswordEmail}</strong>, we've sent you a password reset link.</p>
                      </div>
                      <Button
                        onClick={() => {
                          setShowForgotPassword(false)
                          setForgotPasswordEmail('')
                          setForgotPasswordSuccess(false)
                        }}
                        className="w-full"
                      >
                        Close
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        Enter your email address and we'll send you a link to reset your password.
                      </p>
                      <div className="relative h-max">
                        <Input
                          placeholder="your.email@example.com"
                          className="peer ps-9"
                          type="email"
                          value={forgotPasswordEmail}
                          onChange={(e) => {
                            setForgotPasswordEmail(e.target.value)
                            setError(null)
                          }}
                          required
                          autoComplete="email"
                        />
                        <div className="text-muted-foreground pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
                          <Mail className="size-4" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowForgotPassword(false)
                            setForgotPasswordEmail('')
                            setError(null)
                          }}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={forgotPasswordLoading}
                          className="flex-1"
                        >
                          {forgotPasswordLoading ? 'Sending...' : 'Send Reset Link'}
                        </Button>
                      </div>
                    </form>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </main>
  )
}
