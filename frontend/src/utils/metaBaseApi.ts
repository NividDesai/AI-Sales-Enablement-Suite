/**
 * Meta Base API Integration
 * Utility for fetching and generating graph data from Meta Base API
 * 
 * This utility provides functions to generate chart data from statistics.
 * Can be extended to fetch real-time data from Meta Base API endpoints.
 */

/**
 * Fetch statistics from backend API (optional - can be used for real-time data)
 */
export async function fetchBackendStats(): Promise<any> {
  try {
    const response = await fetch('http://localhost:4000/api/avatar/stats')
    if (!response.ok) throw new Error('Failed to fetch stats')
    return await response.json()
  } catch (error) {
    console.warn('Failed to fetch backend stats:', error)
    return null
  }
}

export interface MetaBaseDataPoint {
  date: string
  value: number
  label?: string
}

export interface MetaBaseChartData {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    color?: string
  }[]
}

/**
 * Generate time-series data for the last N days based on actual tasks
 */
function generateTimeSeriesDataFromTasks(
  days: number,
  tasks: Array<{ type: string; at: number }>,
  taskType: 'leads' | 'emails' | 'doc'
): MetaBaseDataPoint[] {
  const data: MetaBaseDataPoint[] = []
  const now = new Date()
  const dailyCounts: Record<string, number> = {}
  
  // Initialize last N days with 0
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateKey = date.toISOString().split('T')[0]
    dailyCounts[dateKey] = 0
  }
  
  // Count tasks per day for the specific type
  const typeMap: Record<string, string> = {
    'leads': 'leads',
    'emails': 'emails',
    'doc': 'doc'
  }
  
  tasks.forEach(task => {
    if (task.type === typeMap[taskType]) {
      const date = new Date(task.at)
      const dateKey = date.toISOString().split('T')[0]
      if (dailyCounts[dateKey] !== undefined) {
        dailyCounts[dateKey]++
      }
    }
  })
  
  // Convert to array in chronological order
  return Object.entries(dailyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({
      date,
      value,
      label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }))
}

/**
 * Generate chart data from usage statistics and actual task history
 */
export function generateUsageChartData(
  usage: {
    leadsRuns: number
    emailsGenerated: number
    docsGenerated: number
  },
  tasks: Array<{ type: string; at: number }> = []
): MetaBaseChartData {
  // Use actual task history to generate accurate daily data
  const leadsData = generateTimeSeriesDataFromTasks(7, tasks, 'leads')
  const emailsData = generateTimeSeriesDataFromTasks(7, tasks, 'emails')
  const docsData = generateTimeSeriesDataFromTasks(7, tasks, 'doc')
  
  // Ensure all arrays have the same length and labels
  const labels = leadsData.map(d => d.label || d.date)
  
  return {
    labels,
    datasets: [
      {
        label: 'Lead Runs',
        data: leadsData.map(d => d.value),
        color: '#3b82f6' // blue
      },
      {
        label: 'Emails Generated',
        data: emailsData.map(d => d.value),
        color: '#10b981' // green
      },
      {
        label: 'Docs Generated',
        data: docsData.map(d => d.value),
        color: '#a855f7' // purple
      }
    ]
  }
}

/**
 * Generate activity distribution chart data
 */
export function generateActivityDistribution(tasks: Array<{ type: string; at: number }>): {
  labels: string[]
  data: number[]
  colors: string[]
} {
  const distribution: Record<string, number> = {
    leads: 0,
    emails: 0,
    doc: 0
  }
  
  tasks.forEach(task => {
    if (task.type in distribution) {
      distribution[task.type as keyof typeof distribution]++
    }
  })
  
  return {
    labels: ['Lead Runs', 'Emails', 'Documents'],
    data: [distribution.leads, distribution.emails, distribution.doc],
    colors: ['#3b82f6', '#10b981', '#a855f7']
  }
}

/**
 * Generate daily activity trend
 */
export function generateDailyActivityTrend(tasks: Array<{ at: number }>): MetaBaseDataPoint[] {
  const now = new Date()
  const dailyCounts: Record<string, number> = {}
  
  // Initialize last 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dateKey = date.toISOString().split('T')[0]
    dailyCounts[dateKey] = 0
  }
  
  // Count tasks per day
  tasks.forEach(task => {
    const date = new Date(task.at)
    const dateKey = date.toISOString().split('T')[0]
    if (dailyCounts[dateKey] !== undefined) {
      dailyCounts[dateKey]++
    }
  })
  
  // Convert to array
  return Object.entries(dailyCounts).map(([date, value]) => ({
    date,
    value,
    label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }))
}

