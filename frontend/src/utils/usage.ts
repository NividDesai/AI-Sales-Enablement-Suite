export type Usage = { leadsRuns: number; emailsGenerated: number; docsGenerated: number }
export type Task = { id: string; type: 'leads'|'emails'|'doc'; title: string; at: number; meta?: any }

const USAGE_KEY = 'app_usage'
const TASKS_KEY = 'app_tasks'

function read<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback }
}
function write<T>(key: string, val: T) { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} }

export function getUsage(): Usage {
  return read<Usage>(USAGE_KEY, { leadsRuns: 0, emailsGenerated: 0, docsGenerated: 0 })
}
export function incUsage(partial: Partial<Usage>) {
  const u = getUsage(); const n = { ...u, ...Object.fromEntries(Object.entries(partial).map(([k,v]) => [k, (u as any)[k] + (v as number)])) }
  write(USAGE_KEY, n)
}

export function getTasks(): Task[] { return read<Task[]>(TASKS_KEY, []) }
export function addTask(t: Task) {
  const tasks = getTasks()
  tasks.unshift(t)
  write(TASKS_KEY, tasks.slice(0, 50))
}
