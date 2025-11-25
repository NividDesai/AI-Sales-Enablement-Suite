import React, { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { getTasks, getUsage } from '../utils/usage'
import { SectionCard } from '../components/ui/section-card'
import { useAuth } from '../components/AuthProvider'
import { PageHeader } from '../components/ui/page-header'
import { 
  Users, Mail, FileText, Clock, TrendingUp, Activity,
  CheckCircle2, AlertCircle, User, Building2, Phone, BarChart3, PieChart,
  Sparkles, Zap, Target, ArrowRight, Calendar, Star, LayoutDashboard
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import {
  generateUsageChartData,
  generateActivityDistribution,
  generateDailyActivityTrend
} from '../utils/metaBaseApi'

export default function Dashboard() {
  const { user } = useAuth()
  
  // State to track usage and tasks so they can be refreshed
  const [usage, setUsage] = useState(getUsage())
  const [allTasks, setAllTasks] = useState(getTasks())
  
  // Refresh data when component mounts or becomes visible
  useEffect(() => {
    let lastUsageStr = ''
    let lastTasksStr = ''
    
    const refreshData = () => {
      const newUsage = getUsage()
      const newTasks = getTasks()
      const newUsageStr = JSON.stringify(newUsage)
      const newTasksStr = JSON.stringify(newTasks)
      
      // Only update if data actually changed
      if (newUsageStr !== lastUsageStr || newTasksStr !== lastTasksStr) {
        setUsage(newUsage)
        setAllTasks(newTasks)
        lastUsageStr = newUsageStr
        lastTasksStr = newTasksStr
      }
    }
    
    // Initialize
    const initialUsage = getUsage()
    const initialTasks = getTasks()
    lastUsageStr = JSON.stringify(initialUsage)
    lastTasksStr = JSON.stringify(initialTasks)
    setUsage(initialUsage)
    setAllTasks(initialTasks)
    
    // Refresh when page becomes visible (user switches back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshData()
      }
    }
    
    // Refresh on focus (user clicks on the tab/window)
    const handleFocus = () => {
      refreshData()
    }
    
    // Set up interval to refresh every 5 seconds when page is visible (reduced frequency to prevent blinking)
    const interval = setInterval(() => {
      if (!document.hidden) {
        refreshData()
      }
    }, 5000)
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])
  
  // Sort by date (most recent first) and limit to 3
  const tasks = [...allTasks]
    .sort((a, b) => b.at - a.at)
    .slice(0, 3)
  
  // State for dynamically generated charts from chatbox
  const [generatedCharts, setGeneratedCharts] = useState<Array<{
    id: string
    data: any[]
    type: 'line' | 'bar' | 'pie' | 'area'
    title: string
  }>>([])
  
  // Memoize label function to prevent re-creation on every render
  const pieLabelFunction = useMemo(() => 
    ({ name, percent }: { name: string; percent: number }) => `${name}: ${(percent * 100).toFixed(0)}%`,
    []
  )
  
  // Generate chart data using Meta Base API utilities (pass tasks for accurate data)
  // Memoize to prevent re-renders and blinking
  const usageChartData = useMemo(() => generateUsageChartData(usage, allTasks), [usage, allTasks])
  const activityDistribution = useMemo(() => generateActivityDistribution(allTasks), [allTasks])
  const dailyActivityTrend = useMemo(() => generateDailyActivityTrend(allTasks), [allTasks])
  
  // Prepare data for charts with error handling - memoized to prevent blinking
  const lineChartData = useMemo(() => usageChartData.labels.map((label, index) => ({
    date: label,
    'Lead Runs': usageChartData.datasets[0]?.data[index] || 0,
    'Emails Generated': usageChartData.datasets[1]?.data[index] || 0,
    'Docs Generated': usageChartData.datasets[2]?.data[index] || 0
  })), [usageChartData])
  
  const pieChartData = useMemo(() => {
    const data = activityDistribution.labels.map((label, index) => ({
      name: label,
      value: activityDistribution.data[index] || 0,
      color: activityDistribution.colors[index] || '#3b82f6'
    })).filter(item => item.value > 0);
    // Sort by name to ensure consistent order
    return data.sort((a, b) => a.name.localeCompare(b.name));
  }, [activityDistribution]) // Only show non-zero values
  
  const dailyTrendData = useMemo(() => dailyActivityTrend.map(d => ({
    date: d.label || d.date,
    activities: d.value || 0
  })), [dailyActivityTrend])

  // Calculate total activities
  const totalActivities = usage.leadsRuns + usage.emailsGenerated + usage.docsGenerated
  const completionRate = allTasks.length > 0 ? Math.round((allTasks.filter(t => t.type).length / allTasks.length) * 100) : 0

  return (
    <div className="min-h-screen bg-black p-6 sm:p-8 md:p-10 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-8 sm:space-y-10">
        {/* Header Section */}
        <PageHeader
          title="Dashboard"
          description={user?.name ? `Welcome back, ${user.name}!` : 'Welcome back!'}
          icon={<LayoutDashboard className="w-6 h-6 text-white" />}
          actions={
            <div className="px-4 py-2 rounded-lg bg-black/50 border border-white/10">
              <div className="text-xs text-white/60">Total Activities</div>
              <div className="text-2xl font-bold text-white">{totalActivities.toLocaleString()}</div>
            </div>
          }
        />

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="rounded-xl bg-black/50 backdrop-blur-sm border border-white/10 p-6 hover:bg-black/70 hover:border-white/20 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-black/70 border border-white/10">
                <Users className="w-6 h-6 text-white" />
              </div>
              <TrendingUp className="w-5 h-5 text-white/40" />
            </div>
            <div className="text-sm text-white/60 mb-1">Lead Runs</div>
            <div className="text-3xl font-bold text-white mb-1">{usage.leadsRuns.toLocaleString()}</div>
            <div className="text-xs text-white/40">Total lead discoveries</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl bg-black/50 backdrop-blur-sm border border-white/10 p-6 hover:bg-black/70 hover:border-white/20 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-black/70 border border-white/10">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <TrendingUp className="w-5 h-5 text-white/40" />
            </div>
            <div className="text-sm text-white/60 mb-1">Emails Generated</div>
            <div className="text-3xl font-bold text-white mb-1">{usage.emailsGenerated.toLocaleString()}</div>
            <div className="text-xs text-white/40">Total emails created</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl bg-black/50 backdrop-blur-sm border border-white/10 p-6 hover:bg-black/70 hover:border-white/20 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-black/70 border border-white/10">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <TrendingUp className="w-5 h-5 text-white/40" />
            </div>
            <div className="text-sm text-white/60 mb-1">Docs Generated</div>
            <div className="text-3xl font-bold text-white mb-1">{usage.docsGenerated.toLocaleString()}</div>
            <div className="text-xs text-white/40">Total documents created</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl bg-black/50 backdrop-blur-sm border border-white/10 p-6 hover:bg-black/70 hover:border-white/20 transition-all group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-lg bg-black/70 border border-white/10">
                <CheckCircle2 className="w-6 h-6 text-white" />
              </div>
              <Target className="w-5 h-5 text-white/40" />
            </div>
            <div className="text-sm text-white/60 mb-1">Completion Rate</div>
            <div className="text-3xl font-bold text-white mb-1">{completionRate}%</div>
            <div className="text-xs text-white/40">Tasks completed</div>
          </motion.div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Charts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Usage Trends Chart */}
            <SectionCard
              title="Usage Trends"
              description="7-day activity overview"
              icon={<TrendingUp className="w-5 h-5" />}
            >
              <div className="h-64 sm:h-80 relative rounded-xl overflow-hidden bg-black/50 p-4 border border-white/10">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.2} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    style={{ fontSize: '11px', fontWeight: '500' }}
                    tick={{ fill: '#ffffff' }}
                  />
                  <YAxis 
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    style={{ fontSize: '11px', fontWeight: '500' }}
                    tick={{ fill: '#ffffff' }}
                    domain={[0, 'auto']}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(0, 0, 0, 0.98)',
                      border: '2px solid rgba(255, 255, 255, 0.8)',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: '600',
                      padding: '12px',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.8)'
                    }}
                    labelStyle={{ color: '#ffffff', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}
                    itemStyle={{ color: '#ffffff', fontWeight: '600', fontSize: '13px' }}
                    cursor={{ stroke: '#ffffff', strokeWidth: 2 }}
                  />
                  <Legend 
                    wrapperStyle={{ color: '#ffffff', fontSize: '12px' }}
                    iconType="line"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Lead Runs" 
                    stroke="#3b82f6" 
                    strokeWidth={2.5}
                    dot={{ fill: '#3b82f6', r: 4, stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Emails Generated" 
                    stroke="#10b981" 
                    strokeWidth={2.5}
                    dot={{ fill: '#10b981', r: 4, stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Docs Generated" 
                    stroke="#a855f7" 
                    strokeWidth={2.5}
                    dot={{ fill: '#a855f7', r: 4, stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#a855f7', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              </div>
            </SectionCard>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Activity Distribution Pie Chart */}
              <SectionCard
                title="Activity Distribution"
                description="Breakdown of your activities"
                icon={<PieChart className="w-5 h-5" />}
              >
                {pieChartData.length === 0 ? (
                  <div className="h-64 sm:h-80 flex items-center justify-center">
                    <div className="text-center">
                      <AlertCircle className="w-12 h-12 text-white/40 mx-auto mb-4" />
                      <p className="text-white/60 text-sm">No activity data available yet</p>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 sm:h-80 relative rounded-xl overflow-hidden bg-black/50 p-4 border border-white/10">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart key={`pie-${pieChartData.map(d => `${d.name}-${d.value}`).join('-')}`}>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={pieLabelFunction}
                          outerRadius={80}
                          fill="#ffffff"
                          dataKey="value"
                          stroke="#000000"
                          strokeWidth={2}
                          isAnimationActive={false}
                          animationBegin={0}
                          animationDuration={0}
                          nameKey="name"
                        >
                          {pieChartData.map((entry, index) => {
                            // Alternate between white and black for pie segments
                            const fillColor = index % 2 === 0 ? '#ffffff' : '#000000'
                            return (
                              <Cell 
                                key={`cell-${entry.name}-${entry.value}-${index}`} 
                                fill={fillColor}
                                stroke="#000000"
                                strokeWidth={2}
                              />
                            )
                          })}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'rgba(0, 0, 0, 0.98)',
                            border: '2px solid rgba(255, 255, 255, 0.8)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontSize: '14px',
                            fontWeight: '600',
                            padding: '12px',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.8)'
                          }}
                          labelStyle={{ color: '#ffffff', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}
                          itemStyle={{ color: '#ffffff', fontWeight: '600', fontSize: '13px' }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </SectionCard>

              {/* Daily Activity Trend Bar Chart */}
              <SectionCard
                title="Daily Activity Trend"
                description="Your activity over the last 7 days"
                icon={<TrendingUp className="w-5 h-5" />}
              >
                <div className="h-64 sm:h-80 relative rounded-xl overflow-hidden bg-black/50 p-4 border border-white/10">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.2} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#ffffff"
                        strokeWidth={1.5}
                        style={{ fontSize: '11px', fontWeight: '500' }}
                        tick={{ fill: '#ffffff' }}
                      />
                      <YAxis 
                        stroke="#ffffff"
                        strokeWidth={1.5}
                        style={{ fontSize: '11px', fontWeight: '500' }}
                        tick={{ fill: '#ffffff' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(0, 0, 0, 0.98)',
                          border: '2px solid rgba(255, 255, 255, 0.8)',
                          borderRadius: '8px',
                          color: '#ffffff',
                          fontSize: '14px',
                          fontWeight: '600',
                          padding: '12px',
                          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.8)'
                        }}
                        labelStyle={{ color: '#ffffff', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}
                        itemStyle={{ color: '#ffffff', fontWeight: '600', fontSize: '13px' }}
                        cursor={{ stroke: '#ffffff', strokeWidth: 2 }}
                      />
                      <Bar 
                        dataKey="activities" 
                        fill="#ffffff"
                        radius={[8, 8, 0, 0]}
                        stroke="#000000"
                        strokeWidth={2}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Account Information */}
            {user && (
              <SectionCard
                title="Profile"
                description="Your account details"
                icon={<User className="w-5 h-5" />}
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-black/50 border border-white/10">
                    <User className="w-5 h-5 text-white/60" />
                    <div className="flex-1">
                      <div className="text-xs text-white/60">Name</div>
                      <div className="text-sm font-semibold text-white">{user.name || 'Not set'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-black/50 border border-white/10">
                    <Mail className="w-5 h-5 text-white/60" />
                    <div className="flex-1">
                      <div className="text-xs text-white/60">Email</div>
                      <div className="text-sm font-semibold text-white">{user.email}</div>
                    </div>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-black/50 border border-white/10">
                      <Phone className="w-5 h-5 text-white/60" />
                      <div className="flex-1">
                        <div className="text-xs text-white/60">Phone</div>
                        <div className="text-sm font-semibold text-white">{user.phone}</div>
                      </div>
                    </div>
                  )}
                  {user.company && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-black/50 border border-white/10">
                      <Building2 className="w-5 h-5 text-white/60" />
                      <div className="flex-1">
                        <div className="text-xs text-white/60">Company</div>
                        <div className="text-sm font-semibold text-white">{user.company}</div>
                        {user.position && (
                          <div className="text-xs text-white/40 mt-1">{user.position}</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Recent Tasks */}
            <SectionCard
              title="Recent Activity"
              description="Latest operations"
              icon={<Clock className="w-5 h-5" />}
            >
          {tasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-black/50 border border-white/10 mb-4">
                <AlertCircle className="w-8 h-8 text-white/40" />
              </div>
              <p className="text-white/60 text-sm">No tasks yet. Start by generating leads or creating documents!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task, index) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="rounded-xl bg-black/50 backdrop-blur-sm border border-white/10 p-4 hover:bg-black/70 hover:border-white/15 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {task.type === 'leads' && <Users className="w-4 h-4 text-white flex-shrink-0" />}
                        {task.type === 'emails' && <Mail className="w-4 h-4 text-white flex-shrink-0" />}
                        {task.type === 'doc' && <FileText className="w-4 h-4 text-white flex-shrink-0" />}
                        <h4 className="text-white font-semibold text-sm sm:text-base truncate">{task.title}</h4>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(task.at).toLocaleString()}</span>
                      </div>
                      {task.meta && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Object.entries(task.meta).map(([key, value]) => (
                            <span
                              key={key}
                              className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-white/60"
                            >
                              {key}: {String(value)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
            </SectionCard>
          </div>
        </div>

        {/* Dynamically Generated Charts from Meta Base */}
        {generatedCharts.length > 0 && (
          <SectionCard
            title="AI Generated Charts"
            description="Charts created from your natural language queries"
            icon={<BarChart3 className="w-5 h-5" />}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {generatedCharts.map((chart, index) => (
                <motion.div
                  key={chart.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white/5 border border-white/10 rounded-xl p-4"
                >
                  <h4 className="text-white font-semibold mb-4">{chart.title}</h4>
                  <div className="h-64 relative rounded-xl overflow-hidden bg-white/5 p-4 border border-white/10">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
                    <ResponsiveContainer width="100%" height="100%">
                      {chart.type === 'pie' ? (
                        <RechartsPieChart>
                          <Pie
                            data={chart.data}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }: { name: string; percent: number }) => 
                              `${name}: ${(percent * 100).toFixed(0)}%`
                            }
                            outerRadius={80}
                            fill="#ffffff"
                            dataKey="value"
                            stroke="#000000"
                            strokeWidth={2}
                          >
                            {chart.data.map((entry: any, idx: number) => {
                              const fillColor = idx % 2 === 0 ? '#ffffff' : '#000000'
                              return (
                                <Cell 
                                  key={`cell-${idx}`} 
                                  fill={fillColor}
                                  stroke="#000000"
                                  strokeWidth={2}
                                />
                              )
                            })}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(0, 0, 0, 0.95)',
                              border: '1px solid rgba(255, 255, 255, 0.3)',
                              borderRadius: '8px',
                              color: '#fff'
                            }}
                            labelStyle={{ color: '#ffffff', fontWeight: '600' }}
                          />
                        </RechartsPieChart>
                      ) : chart.type === 'line' ? (
                        <LineChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.2} />
                          <XAxis 
                            dataKey={chart.data[0]?.date ? 'date' : 'name'} 
                            stroke="#ffffff"
                            strokeWidth={1.5}
                            style={{ fontSize: '11px', fontWeight: '500' }}
                            tick={{ fill: '#ffffff' }}
                          />
                          <YAxis 
                            stroke="#ffffff"
                            strokeWidth={1.5}
                            style={{ fontSize: '11px', fontWeight: '500' }}
                            tick={{ fill: '#ffffff' }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(0, 0, 0, 0.95)',
                              border: '1px solid rgba(255, 255, 255, 0.3)',
                              borderRadius: '8px',
                              color: '#fff'
                            }}
                            labelStyle={{ color: '#ffffff', fontWeight: '600' }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#000000" 
                            strokeWidth={2.5}
                            dot={{ fill: '#ffffff', r: 4, stroke: '#000000', strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: '#ffffff', stroke: '#000000', strokeWidth: 2 }}
                          />
                        </LineChart>
                      ) : chart.type === 'area' ? (
                        <AreaChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.2} />
                          <XAxis 
                            dataKey={chart.data[0]?.date ? 'date' : 'name'} 
                            stroke="#ffffff"
                            strokeWidth={1.5}
                            style={{ fontSize: '11px', fontWeight: '500' }}
                            tick={{ fill: '#ffffff' }}
                          />
                          <YAxis 
                            stroke="#ffffff"
                            strokeWidth={1.5}
                            style={{ fontSize: '11px', fontWeight: '500' }}
                            tick={{ fill: '#ffffff' }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(0, 0, 0, 0.95)',
                              border: '1px solid rgba(255, 255, 255, 0.3)',
                              borderRadius: '8px',
                              color: '#fff'
                            }}
                            labelStyle={{ color: '#ffffff', fontWeight: '600' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#000000" 
                            strokeWidth={2.5}
                            fill="#ffffff"
                            fillOpacity={0.3}
                          />
                        </AreaChart>
                      ) : (
                        <BarChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" strokeOpacity={0.2} />
                          <XAxis 
                            dataKey="name" 
                            stroke="#ffffff"
                            strokeWidth={1.5}
                            style={{ fontSize: '11px', fontWeight: '500' }}
                            tick={{ fill: '#ffffff' }}
                          />
                          <YAxis 
                            stroke="#ffffff"
                            strokeWidth={1.5}
                            style={{ fontSize: '11px', fontWeight: '500' }}
                            tick={{ fill: '#ffffff' }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'rgba(0, 0, 0, 0.95)',
                              border: '1px solid rgba(255, 255, 255, 0.3)',
                              borderRadius: '8px',
                              color: '#fff'
                            }}
                            labelStyle={{ color: '#ffffff', fontWeight: '600' }}
                          />
                          <Bar 
                            dataKey="value" 
                            fill="#ffffff"
                            radius={[8, 8, 0, 0]}
                            stroke="#000000"
                            strokeWidth={2}
                          />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Meta Base Chart Generator - Full Width */}
        <SectionCard
          title="Generate Chart from Meta Base"
          description="Enter a query to generate a chart"
          icon={<BarChart3 className="w-5 h-5" />}
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="e.g., generate me a chart of all the leads from USA"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20 text-sm sm:text-base"
              onKeyPress={async (e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  const query = e.currentTarget.value.trim()
                  e.currentTarget.value = ''
                  try {
                    const { generateChartFromQuery } = await import('../utils/nlpChartGenerator')
                    const result = await generateChartFromQuery(query)
                    if (result.chartData && result.chartData.length > 0) {
                      const newChart = {
                        id: Date.now().toString(),
                        data: result.chartData,
                        type: result.chartType as 'line' | 'bar' | 'pie' | 'area',
                        title: result.title || `Generated Chart ${generatedCharts.length + 1}`
                      }
                      setGeneratedCharts(prev => [...prev, newChart])
                    }
                  } catch (error) {
                    console.error('Error generating chart:', error)
                  }
                }
              }}
            />
            <button
              onClick={async (e) => {
                const input = (e.currentTarget.previousElementSibling as HTMLInputElement)
                if (input && input.value.trim()) {
                  const query = input.value.trim()
                  input.value = ''
                  try {
                    const { generateChartFromQuery } = await import('../utils/nlpChartGenerator')
                    const result = await generateChartFromQuery(query)
                    if (result.chartData && result.chartData.length > 0) {
                      const newChart = {
                        id: Date.now().toString(),
                        data: result.chartData,
                        type: result.chartType as 'line' | 'bar' | 'pie' | 'area',
                        title: result.title || `Generated Chart ${generatedCharts.length + 1}`
                      }
                      setGeneratedCharts(prev => [...prev, newChart])
                    }
                  } catch (error) {
                    console.error('Error generating chart:', error)
                  }
                }
              }}
              className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white font-medium transition-all whitespace-nowrap flex items-center justify-center gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              Generate
            </button>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const baseCardClasses = 'bg-white/5 border border-white/10 text-white'
  const baseIconClasses = 'p-2 rounded-lg bg-white/10 border border-white/10 text-white'

  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -4 }}
      className={`rounded-xl backdrop-blur-sm p-4 sm:p-6 ${baseCardClasses}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={baseIconClasses}>
          {icon}
        </div>
      </div>
      <div className="text-xs sm:text-sm text-white/60 mb-1">{label}</div>
      <div className="text-3xl sm:text-4xl font-bold text-white">{value.toLocaleString()}</div>
    </motion.div>
  )
}
