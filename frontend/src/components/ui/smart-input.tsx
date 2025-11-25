import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Input } from './input'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface SmartInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  icon?: React.ReactNode
}

export function SmartInput({ label, icon, className, ...props }: SmartInputProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-white/70 flex items-center gap-2">
          {icon}
          {label}
        </label>
      )}
      <motion.div whileHover={{ scale: 1.01 }} whileFocus={{ scale: 1.01 }}>
        <Input
          className={cn(
            "w-full px-4 py-3 rounded-xl bg-black/50 backdrop-blur-xl border border-white/10 text-white placeholder:text-white/40 focus:border-white/20 focus:ring-2 focus:ring-white/10 transition-all",
            className
          )}
          {...props}
        />
      </motion.div>
    </div>
  )
}

interface SmartTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  icon?: React.ReactNode
  expandable?: boolean
  aiAssist?: boolean
  onAiAssist?: () => void
}

export function SmartTextarea({ 
  label, 
  icon, 
  expandable = false, 
  aiAssist = false, 
  onAiAssist,
  className,
  rows = 4,
  ...props 
}: SmartTextareaProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [currentRows, setCurrentRows] = useState(rows)

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-white/70 flex items-center gap-2">
            {icon}
            {label}
          </label>
          <div className="flex items-center gap-2">
            {aiAssist && onAiAssist && (
              <motion.button
                onClick={onAiAssist}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 transition-all"
                title="AI Assist"
              >
                AI
              </motion.button>
            )}
            {expandable && (
              <motion.button
                onClick={() => {
                  setIsExpanded(!isExpanded)
                  setCurrentRows(isExpanded ? rows : rows * 2)
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
              >
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </motion.button>
            )}
          </div>
        </div>
      )}
      <motion.textarea
        whileHover={{ scale: 1.01 }}
        whileFocus={{ scale: 1.01 }}
        rows={currentRows}
        className={cn(
          "w-full px-4 py-3 rounded-xl bg-black/50 backdrop-blur-xl border border-white/10 text-white placeholder:text-white/40 focus:border-white/20 focus:ring-2 focus:ring-white/10 transition-all resize-none",
          className
        )}
        {...props}
      />
    </div>
  )
}

interface SmartSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  icon?: React.ReactNode
  options: Array<{ value: string; label: string }>
}

export function SmartSelect({ label, icon, options, className, ...props }: SmartSelectProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-white/70 flex items-center gap-2">
          {icon}
          {label}
        </label>
      )}
      <motion.div whileHover={{ scale: 1.01 }} whileFocus={{ scale: 1.01 }}>
        <select
          className={cn(
            "w-full px-4 py-3 rounded-xl bg-black/50 backdrop-blur-xl border border-white/10 text-white focus:border-white/20 focus:ring-2 focus:ring-white/10 transition-all appearance-none cursor-pointer",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-neutral-900 text-white">
              {opt.label}
            </option>
          ))}
        </select>
      </motion.div>
    </div>
  )
}

interface SmartToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

export function SmartToggle({ label, checked, onChange }: SmartToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium text-white/70 cursor-pointer flex items-center gap-2">
        <motion.button
          onClick={() => onChange(!checked)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            "relative w-11 h-6 rounded-full transition-colors",
            checked ? "bg-black" : "bg-white/20"
          )}
        >
          <motion.span
            className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md"
            animate={{ x: checked ? 20 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </motion.button>
        {label}
      </label>
    </div>
  )
}
