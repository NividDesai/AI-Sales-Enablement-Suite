'use client'

import * as React from 'react'
import { motion, type Transition, AnimatePresence } from 'framer-motion'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react'

interface TodoItem {
  id: number
  label: string
  defaultChecked: boolean
}

interface PlayfulTodoListProps {
  items?: TodoItem[]
  storageKey?: string
}

const defaultItems: TodoItem[] = [
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
]

const getPathAnimate = (isChecked: boolean) => ({
  pathLength: isChecked ? 1 : 0,
  opacity: isChecked ? 1 : 0,
})

const getPathTransition = (isChecked: boolean): Transition => ({
  pathLength: { duration: 1, ease: 'easeInOut' },
  opacity: {
    duration: 0.01,
    delay: isChecked ? 0 : 1,
  },
})

export const PlayfulTodoList = ({ items = defaultItems, storageKey = 'playful-todolist' }: PlayfulTodoListProps) => {
  // Load from localStorage on mount
  const [todoItems, setTodoItems] = React.useState<TodoItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {
          return items
        }
      }
    }
    return items
  })

  const [checked, setChecked] = React.useState<boolean[]>(() => {
    if (typeof window !== 'undefined') {
      const savedChecked = localStorage.getItem(`${storageKey}-checked`)
      if (savedChecked) {
        try {
          return JSON.parse(savedChecked)
        } catch {
          return todoItems.map((i) => !!i.defaultChecked)
        }
      }
    }
    return todoItems.map((i) => !!i.defaultChecked)
  })

  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [editingText, setEditingText] = React.useState('')
  const [newTodoText, setNewTodoText] = React.useState('')
  const [isAdding, setIsAdding] = React.useState(false)
  const nextIdRef = React.useRef(Math.max(...todoItems.map(i => i.id), 0) + 1)

  // Save to localStorage whenever items or checked state changes
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(todoItems))
      localStorage.setItem(`${storageKey}-checked`, JSON.stringify(checked))
    }
  }, [todoItems, checked, storageKey])

  const handleCheckChange = (idx: number, val: boolean) => {
    const updated = [...checked]
    updated[idx] = val === true
    setChecked(updated)
  }

  const handleEdit = (id: number) => {
    const item = todoItems.find(i => i.id === id)
    if (item) {
      setEditingId(id)
      setEditingText(item.label)
    }
  }

  const handleSaveEdit = (id: number) => {
    if (editingText.trim()) {
      setTodoItems(prev => prev.map(item => 
        item.id === id ? { ...item, label: editingText.trim() } : item
      ))
    }
    setEditingId(null)
    setEditingText('')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingText('')
  }

  const handleDelete = (id: number) => {
    const idx = todoItems.findIndex(i => i.id === id)
    if (idx !== -1) {
      setTodoItems(prev => prev.filter(item => item.id !== id))
      setChecked(prev => prev.filter((_, i) => i !== idx))
    }
  }

  const handleAdd = () => {
    if (newTodoText.trim()) {
      const newItem: TodoItem = {
        id: nextIdRef.current++,
        label: newTodoText.trim(),
        defaultChecked: false,
      }
      setTodoItems(prev => [...prev, newItem])
      setChecked(prev => [...prev, false])
      setNewTodoText('')
      setIsAdding(false)
    }
  }

  const handleStartAdd = () => {
    setIsAdding(true)
  }

  const handleCancelAdd = () => {
    setIsAdding(false)
    setNewTodoText('')
  }

  return (
    <div className="space-y-3">
      {/* Add New Todo */}
      <AnimatePresence>
        {isAdding ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 pb-3 mb-3 border-b border-white/10"
          >
            <Input
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') handleCancelAdd()
              }}
              placeholder="Enter new task..."
              className="flex-1 bg-black/50 border-white/20 text-white placeholder:text-white/40 text-sm h-9"
              autoFocus
            />
            <button
              onClick={handleAdd}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
              title="Save"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancelAdd}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ) : (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={handleStartAdd}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white transition-all text-sm mb-3"
          >
            <Plus className="w-4 h-4" />
            <span>Add Task</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Todo Items */}
      <div className="space-y-3">
        {todoItems.map((item, idx) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-3 group">
              <Checkbox
                className="transition-colors duration-300 border-white/30 data-[state=checked]:bg-white data-[state=checked]:border-white flex-shrink-0 w-5 h-5"
                checked={checked[idx]}
                onCheckedChange={(val) => handleCheckChange(idx, val === true)}
                id={`checkbox-${item.id}`}
              />
              <div className="relative inline-block flex-1 min-w-0">
                {editingId === item.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(item.id)
                        if (e.key === 'Escape') handleCancelEdit()
                      }}
                        className="flex-1 bg-black/50 border-white/20 text-white text-sm"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(item.id)}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
                      title="Save"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Label 
                      htmlFor={`checkbox-${item.id}`}
                      className="text-white/90 text-sm cursor-pointer block pr-16 leading-relaxed"
                    >
                      {item.label}
                    </Label>
                    <motion.svg
                      width="340"
                      height="32"
                      viewBox="0 0 340 32"
                      className="absolute left-0 top-1/2 -translate-y-1/2 pointer-events-none z-20 w-full h-8"
                    >
                      <motion.path
                        d="M 10 16.91 s 79.8 -11.36 98.1 -11.34 c 22.2 0.02 -47.82 14.25 -33.39 22.02 c 12.61 6.77 124.18 -27.98 133.31 -17.28 c 7.52 8.38 -26.8 20.02 4.61 22.05 c 24.55 1.93 113.37 -20.36 113.37 -20.36"
                        vectorEffect="non-scaling-stroke"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeMiterlimit={10}
                        fill="none"
                        initial={false}
                        animate={getPathAnimate(!!checked[idx])}
                        transition={getPathTransition(!!checked[idx])}
                        className="stroke-white"
                      />
                    </motion.svg>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(item.id)}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
            {idx !== todoItems.length - 1 && (
              <div className="border-t border-white/10" />
            )}
          </motion.div>
        ))}
      </div>

      {todoItems.length === 0 && (
        <div className="text-center py-8 text-white/40 text-sm">
          No tasks yet. Click "Add Task" to get started!
        </div>
      )}
    </div>
  )
}

