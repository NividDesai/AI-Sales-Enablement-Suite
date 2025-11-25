/**
 * NLP Chart Generator
 * Parses natural language queries and generates appropriate charts
 */

import { getTasks, getUsage } from './usage'
import { generateTimeSeriesData, generateActivityDistribution, generateDailyActivityTrend } from './metaBaseApi'

export interface ChartResult {
  message: string
  chartData: any[]
  chartType: 'line' | 'bar' | 'pie' | 'area'
  labels?: string[]
  title?: string
}

// Mock leads data structure (in real app, this would come from API)
interface Lead {
  country?: string
  company?: string
  industry?: string
  date?: string
  [key: string]: any
}

// Fetch leads data - tries API first, then localStorage, then mock data
async function getLeads(): Promise<Lead[]> {
  try {
    // Try to fetch from API (if there's a stored session or recent leads)
    // For now, we'll check localStorage for leads stored by the app
    const storedLeads = localStorage.getItem('app_leads')
    if (storedLeads) {
      try {
        const parsed = JSON.parse(storedLeads)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      } catch {
        // Invalid JSON, continue to mock data
      }
    }

    // Check if leads are stored in window (from HybridPage or App.tsx)
    if (typeof window !== 'undefined' && (window as any).__LEADS__) {
      const windowLeads = (window as any).__LEADS__
      if (Array.isArray(windowLeads) && windowLeads.length > 0) {
        // Store in localStorage for persistence
        localStorage.setItem('app_leads', JSON.stringify(windowLeads))
        return windowLeads
      }
    }
  } catch (error) {
    console.warn('Error fetching leads:', error)
  }
  
  // Generate sample data if none exists
  return [
    { country: 'USA', company: 'Tech Corp', industry: 'Technology', date: '2024-01-15' },
    { country: 'USA', company: 'Data Inc', industry: 'Data Analytics', date: '2024-01-20' },
    { country: 'UK', company: 'Finance Ltd', industry: 'Finance', date: '2024-02-01' },
    { country: 'USA', company: 'Cloud Systems', industry: 'Cloud', date: '2024-02-10' },
    { country: 'Canada', company: 'AI Solutions', industry: 'AI', date: '2024-02-15' },
    { country: 'USA', company: 'Software Co', industry: 'Software', date: '2024-02-20' },
  ]
}

/**
 * Parse NLP query to extract intent and parameters
 */
function parseQuery(query: string): {
  intent: 'chart' | 'filter' | 'statistics' | 'unknown'
  chartType?: 'line' | 'bar' | 'pie' | 'area'
  filters?: Record<string, string>
  metric?: string
  dimension?: string
} {
  const lowerQuery = query.toLowerCase()
  
  // Detect chart type
  let chartType: 'line' | 'bar' | 'pie' | 'area' | undefined
  if (lowerQuery.includes('line chart') || lowerQuery.includes('line graph')) {
    chartType = 'line'
  } else if (lowerQuery.includes('pie chart') || lowerQuery.includes('pie graph')) {
    chartType = 'pie'
  } else if (lowerQuery.includes('area chart') || lowerQuery.includes('area graph')) {
    chartType = 'area'
  } else if (lowerQuery.includes('bar chart') || lowerQuery.includes('bar graph')) {
    chartType = 'bar'
  } else {
    // Default to bar if chart is mentioned
    chartType = lowerQuery.includes('chart') || lowerQuery.includes('graph') ? 'bar' : 'bar'
  }

  // Extract filters
  const filters: Record<string, string> = {}
  
  // Country filter
  const countryMatch = lowerQuery.match(/(?:from|in|of)\s+([A-Z]{2,}|usa|uk|canada|germany|france|india|china|japan|australia)/i)
  if (countryMatch) {
    let country = countryMatch[1].toUpperCase()
    if (country === 'USA') country = 'USA'
    if (country === 'UK') country = 'UK'
    filters.country = country
  }

  // Industry filter
  const industryMatch = lowerQuery.match(/(?:in|of)\s+(technology|tech|finance|healthcare|retail|manufacturing|ai|software|cloud|data)/i)
  if (industryMatch) {
    filters.industry = industryMatch[1]
  }

  // Date/Time filters
  if (lowerQuery.includes('this month') || lowerQuery.includes('current month')) {
    filters.period = 'this_month'
  } else if (lowerQuery.includes('last month')) {
    filters.period = 'last_month'
  } else if (lowerQuery.includes('this year')) {
    filters.period = 'this_year'
  }

  // Detect metrics
  let metric: string | undefined
  if (lowerQuery.includes('lead')) {
    metric = 'leads'
  } else if (lowerQuery.includes('email')) {
    metric = 'emails'
  } else if (lowerQuery.includes('document') || lowerQuery.includes('doc')) {
    metric = 'documents'
  } else if (lowerQuery.includes('activity') || lowerQuery.includes('task')) {
    metric = 'activities'
  }

  // Detect dimension (what to group by)
  let dimension: string | undefined
  if (lowerQuery.includes('by country') || lowerQuery.includes('per country')) {
    dimension = 'country'
  } else if (lowerQuery.includes('by industry') || lowerQuery.includes('per industry')) {
    dimension = 'industry'
  } else if (lowerQuery.includes('by month') || lowerQuery.includes('per month') || lowerQuery.includes('monthly')) {
    dimension = 'month'
  } else if (lowerQuery.includes('by day') || lowerQuery.includes('daily')) {
    dimension = 'day'
  }

  return {
    intent: lowerQuery.includes('chart') || lowerQuery.includes('graph') || lowerQuery.includes('show') || lowerQuery.includes('generate') ? 'chart' : 'unknown',
    chartType,
    filters,
    metric,
    dimension
  }
}

/**
 * Generate chart data based on parsed query
 */
async function generateChartData(parsed: ReturnType<typeof parseQuery>): Promise<ChartResult> {
  const { chartType = 'bar', filters, metric, dimension } = parsed

  // Handle leads queries
  if (metric === 'leads' || parsed.intent === 'chart') {
    const leads = await getLeads()
    
    // Apply filters
    let filteredLeads = leads
    if (filters?.country) {
      filteredLeads = filteredLeads.filter(l => 
        l.country?.toUpperCase() === filters.country.toUpperCase()
      )
    }
    if (filters?.industry) {
      filteredLeads = filteredLeads.filter(l => 
        l.industry?.toLowerCase().includes(filters.industry.toLowerCase())
      )
    }

    // Group by dimension
    if (dimension === 'country') {
      const countryCounts: Record<string, number> = {}
      filteredLeads.forEach(lead => {
        const country = lead.country || 'Unknown'
        countryCounts[country] = (countryCounts[country] || 0) + 1
      })

      const chartData = Object.entries(countryCounts).map(([name, value]) => ({
        name,
        value
      }))

      return {
        message: `Generated a ${chartType} chart showing leads by country${filters?.country ? ` (filtered: ${filters.country})` : ''}. Found ${filteredLeads.length} leads.`,
        chartData: chartData.length > 0 ? chartData : [{ name: 'No Data', value: 0 }],
        chartType: chartType === 'pie' ? 'pie' : 'bar',
        labels: Object.keys(countryCounts),
        title: `Leads by Country${filters?.country ? ` (${filters.country})` : ''}`
      }
    } else if (dimension === 'industry') {
      const industryCounts: Record<string, number> = {}
      filteredLeads.forEach(lead => {
        const industry = lead.industry || 'Unknown'
        industryCounts[industry] = (industryCounts[industry] || 0) + 1
      })

      const chartData = Object.entries(industryCounts).map(([name, value]) => ({
        name,
        value
      }))

      return {
        message: `Generated a ${chartType} chart showing leads by industry${filters?.country ? ` from ${filters.country}` : ''}. Found ${filteredLeads.length} leads.`,
        chartData: chartData.length > 0 ? chartData : [{ name: 'No Data', value: 0 }],
        chartType: chartType === 'pie' ? 'pie' : 'bar',
        labels: Object.keys(industryCounts),
        title: `Leads by Industry${filters?.country ? ` (${filters.country})` : ''}`
      }
    } else {
      // Default: show total count
      return {
        message: `Found ${filteredLeads.length} leads${filters?.country ? ` from ${filters.country}` : ''}. Here's a summary chart.`,
        chartData: [{
          name: 'Total Leads',
          value: filteredLeads.length
        }],
        chartType: 'bar',
        title: 'Total Leads'
      }
    }
  }

  // Handle usage statistics
  if (metric === 'emails' || metric === 'documents' || metric === 'activities') {
    const usage = getUsage()
    const tasks = getTasks()

    if (dimension === 'month' || dimension === 'day') {
      const trendData = generateDailyActivityTrend(tasks)
      const chartData = trendData.map(d => ({
        date: d.label || d.date,
        value: d.value
      }))

      return {
        message: `Generated a ${chartType} chart showing ${dimension === 'month' ? 'monthly' : 'daily'} activity trends.`,
        chartData,
        chartType: chartType === 'line' ? 'line' : 'bar',
        title: `${dimension === 'month' ? 'Monthly' : 'Daily'} Activity Trend`
      }
    }

    // Default usage stats
    const chartData = [
      { name: 'Lead Runs', value: usage.leadsRuns },
      { name: 'Emails Generated', value: usage.emailsGenerated },
      { name: 'Docs Generated', value: usage.docsGenerated }
    ]

    return {
      message: `Generated a ${chartType} chart showing your usage statistics.`,
      chartData,
      chartType: chartType === 'pie' ? 'pie' : 'bar',
      title: 'Usage Statistics'
    }
  }

  // Default response
  return {
    message: 'I generated a chart based on your query. If you need something specific, try asking for "leads from USA" or "emails by month".',
    chartData: [],
    chartType: 'bar',
    title: 'Chart'
  }
}

/**
 * Main function to generate chart from natural language query
 */
export async function generateChartFromQuery(query: string): Promise<ChartResult> {
  // Simulate async processing
  await new Promise(resolve => setTimeout(resolve, 500))

  const parsed = parseQuery(query)
  
  if (parsed.intent === 'unknown') {
    return {
      message: "I didn't quite understand that. Try asking me to:\n• Generate a chart of leads from USA\n• Show me a bar chart of emails by month\n• Create a pie chart of activity distribution",
      chartData: [],
      chartType: 'bar'
    }
  }

  return await generateChartData(parsed)
}

