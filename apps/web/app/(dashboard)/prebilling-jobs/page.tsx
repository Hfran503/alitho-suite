'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

type DismissalRecord = {
  id: string
  note: string
  dismissedByName: string
  dismissedAt: string
  expiresAt: string
  isExpired?: boolean
}

type Job = {
  job?: string // The job number/ID
  customer?: string
  customerName?: string
  customerPORequired?: string // Customer's PO requirement setting
  adminStatus?: string // The JobStatus ID
  adminStatusDescription?: string // The JobStatus description
  description?: string
  promiseDateTime?: string // Due date
  u_proposal_number?: string // Proposal number
  jobValue?: number // Job value
  proposalEstimatePrice?: number // Estimate price from proposal
  amountToInvoice?: number // Amount to invoice from job
  proposalTotalSellPrice?: number // Total sell price from proposal
  proposalEstimate?: string // Estimate number from proposal
  proposalPO?: string // PO from proposal
  csr?: string // CSR ID
  csrName?: string // CSR name
  csrEmail?: string // CSR email
  part1Estimate?: string // Estimate number from JobPart Part 1
  jobType?: number // JobType ID
  jobTypeDescription?: string // JobType description
  poNum?: string // PO number from Job
  changeOrdersWithZeroPrice?: number // Count of ChangeOrders (type 5001) with zero/missing totalBillAmt
  u_planner?: string // Planner ID
  plannerName?: string // Planner name
  plannerEmail?: string // Planner email
  u_calithosuite_note?: string // Calitho Suite note (lowercase to match PACE database field)
  // Dismissal fields
  isDismissed?: boolean
  activeDismissal?: DismissalRecord | null
  dismissalHistory?: DismissalRecord[]
}

type DateFilter = 'all' | 'pastdue' | 'thisweek' | 'thismonth' | 'future'
type SortField = 'job' | 'reference' | 'customer' | 'promiseDateTime' | 'adminStatus'
type SortOrder = 'asc' | 'desc'

export default function PrebillingJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [csrFilter, setCSRFilter] = useState<string>('all')
  const showIssuesOnly = true // Always show only jobs with issues for prebilling
  const [issueTypeFilter, setIssueTypeFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('job')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<'details' | 'dismissals'>('details')
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set())
  const [isSyncing, setIsSyncing] = useState(false)
  const [showSyncConfirmation, setShowSyncConfirmation] = useState(false)
  const [syncMessage, setSyncMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  const [showDueDateModal, setShowDueDateModal] = useState(false)
  const [selectedDueDate, setSelectedDueDate] = useState('')
  const [activeAction, setActiveAction] = useState<'prices' | 'duedates' | null>(null)
  const [sendingEstimateAlert, setSendingEstimateAlert] = useState(false)
  const [estimateAlertMessage, setEstimateAlertMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [selectedJobForNote, setSelectedJobForNote] = useState<Job | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Dismiss functionality state
  const [showDismissModal, setShowDismissModal] = useState(false)
  const [selectedJobForDismiss, setSelectedJobForDismiss] = useState<Job | null>(null)
  const [dismissNote, setDismissNote] = useState('')
  const [dismissing, setDismissing] = useState(false)
  const [showDismissedJobs, setShowDismissedJobs] = useState(false)

  // Get user session for role check
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role || ''
  const userName = (session?.user as any)?.name || ''
  const canSyncPrices = userRole === 'full_admin' || userRole === 'admin'

  // Update current time every minute to refresh "time ago" display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [])

  // Load cached data from localStorage on mount
  useEffect(() => {
    const cachedData = localStorage.getItem('prebilling_jobs_cache')
    const cachedTimestamp = localStorage.getItem('prebilling_jobs_cache_timestamp')

    if (cachedData && cachedTimestamp) {
      const timestamp = new Date(cachedTimestamp)
      const now = new Date()
      const diffMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60)

      // Use cache if less than 15 minutes old
      if (diffMinutes < 15) {
        try {
          const parsed = JSON.parse(cachedData)
          setJobs(parsed)
          setLastFetchTime(timestamp)
          return
        } catch (e) {
          console.error('Failed to parse cached data:', e)
        }
      }
    }

    // If no valid cache, fetch fresh data
    fetchOpenJobs()
  }, [])

  // Auto-filter CSR for customer_service role based on logged-in user's name
  useEffect(() => {
    // Only auto-filter if user is customer_service and jobs are loaded
    if (userRole === 'customer_service' && jobs.length > 0 && userName) {
      // Get unique CSR names from jobs
      const uniqueCSRs = Array.from(new Set(jobs.map(j => j.csrName || j.csr).filter(Boolean)))

      // Try to find a matching CSR name (case-insensitive partial match)
      const matchingCSR = uniqueCSRs.find(csr => {
        if (!csr) return false
        const csrLower = csr.toString().toLowerCase()
        const userNameLower = userName.toLowerCase()

        // Check if CSR name contains any part of the user's name
        const userParts = userNameLower.split(' ')
        return userParts.some((part: string) => part && csrLower.includes(part))
      })

      // Set the filter to the matching CSR if found, only on initial load
      if (matchingCSR && csrFilter === 'all') {
        console.log(`Auto-filtering CSR for ${userName}: ${matchingCSR}`)
        setCSRFilter(matchingCSR)
      }
    }
  }, [jobs, userRole, userName])

  const fetchOpenJobs = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/pace/jobs/prebilling')

      if (!response.ok) {
        let errorData: any = {}
        try {
          errorData = await response.json()
        } catch (e) {
          console.error('Failed to parse error response:', e)
        }

        console.error('API Error Response:', errorData)
        console.error('Response status:', response.status, response.statusText)

        // Check for specific PACE errors
        if (errorData.details?.response?.message === 'System License Expired') {
          throw new Error('PACE System License Expired. Please contact your PACE administrator to renew the license.')
        }

        throw new Error(errorData.error || errorData.message || `API Error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('API Response:', data)

      if (data.success) {
        console.log('Fetched open jobs from API:', data.data.items.length, 'jobs')
        setJobs(data.data.items)

        // Cache the data with timestamp
        const now = new Date()
        setLastFetchTime(now)

        // Try to cache data, handle quota exceeded errors
        try {
          localStorage.setItem('prebilling_jobs_cache', JSON.stringify(data.data.items))
          localStorage.setItem('prebilling_jobs_cache_timestamp', now.toISOString())
        } catch (storageErr) {
          // If quota exceeded, clear old caches and try again
          if (storageErr instanceof DOMException && storageErr.name === 'QuotaExceededError') {
            console.warn('localStorage quota exceeded, clearing old caches...')
            // Clear old job caches to make space
            localStorage.removeItem('open_jobs_cache')
            localStorage.removeItem('open_jobs_cache_timestamp')
            localStorage.removeItem('prebilling_jobs_cache')
            localStorage.removeItem('prebilling_jobs_cache_timestamp')

            // Try one more time with cleared cache
            try {
              localStorage.setItem('prebilling_jobs_cache', JSON.stringify(data.data.items))
              localStorage.setItem('prebilling_jobs_cache_timestamp', now.toISOString())
            } catch (retryErr) {
              console.warn('Still unable to cache data after clearing, skipping cache:', retryErr)
            }
          } else {
            console.warn('Failed to cache data:', storageErr)
          }
        }
      } else {
        console.error('API returned success: false')
        throw new Error('API returned unsuccessful response')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Fetch open jobs error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Handle select all checkbox
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      let jobsToSelect = paginatedJobs
      // If updating prices, only select jobs with prices
      if (activeAction === 'prices') {
        jobsToSelect = paginatedJobs.filter(job => job.proposalTotalSellPrice)
      }
      const jobIds = new Set(jobsToSelect.map(job => job.job!))
      setSelectedJobIds(jobIds)
    } else {
      setSelectedJobIds(new Set())
    }
  }

  // Handle individual checkbox
  const handleSelectJob = (jobId: string, checked: boolean) => {
    const newSelected = new Set(selectedJobIds)
    if (checked) {
      newSelected.add(jobId)
    } else {
      newSelected.delete(jobId)
    }
    setSelectedJobIds(newSelected)
  }

  // Handle sync prices
  const handleSyncPrices = async () => {
    if (selectedJobIds.size === 0) return

    setShowSyncConfirmation(false)
    setIsSyncing(true)
    setSyncMessage(null)

    try {
      const jobsToSync = jobs.filter(job => selectedJobIds.has(job.job!))

      const response = await fetch('/api/pace/jobs/sync-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobs: jobsToSync.map(job => ({
            jobNumber: job.job,
            proposalTotalSellPrice: job.proposalTotalSellPrice
          }))
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setSyncMessage({
          type: 'success',
          text: `Successfully updated prices for ${result.successCount} of ${selectedJobIds.size} jobs`
        })
        setSelectedJobIds(new Set())
        setActiveAction(null)
        // Refresh jobs data
        fetchOpenJobs()
      } else {
        throw new Error(result.error || 'Failed to sync prices')
      }
    } catch (err) {
      setSyncMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'An error occurred while syncing prices'
      })
    } finally {
      setIsSyncing(false)
    }
  }

  // Handle sync due dates
  const handleSyncDueDates = async () => {
    if (selectedJobIds.size === 0 || !selectedDueDate) return

    setShowDueDateModal(false)
    setIsSyncing(true)
    setSyncMessage(null)

    try {
      const jobsToSync = jobs.filter(job => selectedJobIds.has(job.job!))

      const response = await fetch('/api/pace/jobs/sync-due-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobs: jobsToSync.map(job => ({
            jobNumber: job.job
          })),
          dueDate: selectedDueDate
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setSyncMessage({
          type: 'success',
          text: `Successfully updated due dates for ${result.successCount} of ${selectedJobIds.size} jobs`
        })
        setSelectedJobIds(new Set())
        setSelectedDueDate('')
        setActiveAction(null)
        // Refresh jobs data
        fetchOpenJobs()
      } else {
        throw new Error(result.error || 'Failed to sync due dates')
      }
    } catch (err) {
      setSyncMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'An error occurred while syncing due dates'
      })
    } finally {
      setIsSyncing(false)
    }
  }

  // Handle dismissing a job
  const handleDismissJob = async () => {
    if (!selectedJobForDismiss?.job || !dismissNote.trim()) return

    setDismissing(true)
    try {
      const response = await fetch('/api/pace/jobs/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobNumber: selectedJobForDismiss.job,
          note: dismissNote.trim(),
          csrId: selectedJobForDismiss.csr,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to dismiss job')
      }

      const data = await response.json()

      // Update the job in state with the new dismissal
      setJobs(prevJobs => {
        const updatedJobs = prevJobs.map(job =>
          job.job === selectedJobForDismiss.job
            ? {
                ...job,
                isDismissed: true,
                activeDismissal: data.dismissal,
                dismissalHistory: [
                  data.dismissal,
                  ...(job.dismissalHistory || []),
                ],
              }
            : job
        )
        // Update localStorage cache with new dismissal data AND timestamp
        try {
          localStorage.setItem('prebilling_jobs_cache', JSON.stringify(updatedJobs))
          localStorage.setItem('prebilling_jobs_cache_timestamp', new Date().toISOString())
        } catch (e) {
          console.warn('Failed to update cache:', e)
        }
        return updatedJobs
      })

      // Close modal and reset
      setShowDismissModal(false)
      setSelectedJobForDismiss(null)
      setDismissNote('')
    } catch (error) {
      console.error('Failed to dismiss job:', error)
      alert(error instanceof Error ? error.message : 'Failed to dismiss job')
    } finally {
      setDismissing(false)
    }
  }

  // Handle undismissing a job
  const handleUndismissJob = async (job: Job) => {
    if (!job.job) return

    try {
      const response = await fetch(`/api/pace/jobs/dismiss?jobNumber=${job.job}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to undismiss job')
      }

      // Update the job in state - mark the active dismissal as expired in history
      setJobs(prevJobs => {
        const updatedJobs = prevJobs.map(j => {
          if (j.job !== job.job) return j

          // Update dismissal history to mark active dismissal as expired
          const updatedHistory = j.dismissalHistory?.map(d => {
            if (j.activeDismissal && d.id === j.activeDismissal.id) {
              return { ...d, isExpired: true, expiresAt: new Date().toISOString() }
            }
            return d
          }) || []

          return {
            ...j,
            isDismissed: false,
            activeDismissal: null,
            dismissalHistory: updatedHistory,
          }
        })
        // Update localStorage cache AND timestamp
        try {
          localStorage.setItem('prebilling_jobs_cache', JSON.stringify(updatedJobs))
          localStorage.setItem('prebilling_jobs_cache_timestamp', new Date().toISOString())
        } catch (e) {
          console.warn('Failed to update cache:', e)
        }
        return updatedJobs
      })
    } catch (error) {
      console.error('Failed to undismiss job:', error)
      alert(error instanceof Error ? error.message : 'Failed to undismiss job')
    }
  }

  // Check if user can dismiss a job (admin or job's CSR)
  const canDismissJob = (job: Job): boolean => {
    if (userRole === 'full_admin' || userRole === 'admin') return true
    if (userRole === 'customer_service') {
      // Check if the user's name matches the CSR name
      if (userName && job.csrName) {
        const userParts = userName.toLowerCase().split(' ')
        const csrLower = job.csrName.toLowerCase()
        return userParts.some((part: string) => part && csrLower.includes(part))
      }
    }
    return false
  }

  // Helper function to format time ago
  const getTimeAgo = (date: Date | null): string => {
    if (!date) return 'Never'
    // Use currentTime to ensure display updates every minute
    const now = currentTime
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes === 1) return '1 minute ago'
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`

    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours === 1) return '1 hour ago'
    if (diffHours < 24) return `${diffHours} hours ago`

    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return '1 day ago'
    return `${diffDays} days ago`
  }

  // Helper function to check if a date is in a specific range
  const isDateInRange = (dateStr: string | undefined, filter: DateFilter): boolean => {
    if (!dateStr) return filter === 'all' // Jobs without due date only show in 'all'

    const dueDate = new Date(dateStr)
    dueDate.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Calculate next 7 days from today
    const sevenDaysFromNow = new Date(today)
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
    sevenDaysFromNow.setHours(23, 59, 59, 999)

    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    endOfMonth.setHours(23, 59, 59, 999)

    switch (filter) {
      case 'all':
        return true
      case 'pastdue':
        return dueDate < today
      case 'thisweek':
        return dueDate >= today && dueDate <= sevenDaysFromNow
      case 'thismonth':
        return dueDate >= today && dueDate <= endOfMonth
      case 'future':
        return dueDate > endOfMonth
      default:
        return true
    }
  }

  // Handle column sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle order if clicking the same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new field and default to ascending
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, dateFilter, statusFilter, csrFilter, issueTypeFilter])

  // Helper function to extract first name from full name
  const getFirstName = (fullName: string | undefined): string | null => {
    if (!fullName) return null
    const trimmed = fullName.trim()
    if (!trimmed) return null
    return trimmed.split(' ')[0]
  }

  // Helper functions to check specific issue types
  const hasEstimateIssue = (job: Job): boolean => {
    if (!job.proposalEstimate && !job.part1Estimate) return true
    if (!job.proposalEstimate || !job.part1Estimate) return true
    if (job.proposalEstimate !== job.part1Estimate) return true
    return false
  }

  const hasEstimatePriceIssue = (job: Job): boolean => {
    if (!job.proposalEstimatePrice && !job.jobValue) return true
    if (!job.proposalEstimatePrice || !job.jobValue) return true
    if (Math.abs(job.jobValue - job.proposalEstimatePrice) > 100) return true
    return false
  }

  const hasSellPriceIssue = (job: Job): boolean => {
    if (!job.proposalTotalSellPrice && !job.amountToInvoice) return true
    if (!job.proposalTotalSellPrice || !job.amountToInvoice) return true
    if (Math.abs(job.amountToInvoice - job.proposalTotalSellPrice) > 0.01) return true
    return false
  }

  const hasPOIssue = (job: Job): boolean => {
    if (job.customerPORequired !== '1') return false
    const jobPO = job.poNum?.trim()
    const proposalPO = job.proposalPO?.trim()
    if (!jobPO && !proposalPO) return true
    if (jobPO && proposalPO && jobPO !== proposalPO) return true
    return false
  }

  const hasPastDueIssue = (job: Job): boolean => {
    if (!job.promiseDateTime) return false
    const dueDate = new Date(job.promiseDateTime)
    const now = new Date()
    const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    return daysDiff > 14
  }

  const hasChangeOrderIssue = (job: Job): boolean => {
    return !!(job.changeOrdersWithZeroPrice && job.changeOrdersWithZeroPrice > 0)
  }

  // Helper function to check if a job has any issues
  const jobHasIssues = (job: Job): boolean => {
    // Check estimate number issues
    if (!job.proposalEstimate && !job.part1Estimate) {
      return true // No estimate data
    }
    if (!job.proposalEstimate || !job.part1Estimate) {
      return true // Missing one estimate
    }
    if (job.proposalEstimate !== job.part1Estimate) {
      return true // Estimate mismatch (exact match required, versions matter)
    }

    // Check estimate price issues
    if (!job.proposalEstimatePrice && !job.jobValue) {
      return true // No data
    }
    if (!job.proposalEstimatePrice || !job.jobValue) {
      return true // Missing one value
    }
    if (Math.abs(job.jobValue - job.proposalEstimatePrice) > 100) {
      return true // Price difference
    }

    // Check sell price issues
    if (!job.proposalTotalSellPrice && !job.amountToInvoice) {
      return true // No data
    }
    if (!job.proposalTotalSellPrice || !job.amountToInvoice) {
      return true // Missing one value
    }
    if (Math.abs(job.amountToInvoice - job.proposalTotalSellPrice) > 0.01) {
      return true // Invoice difference
    }

    // Check PO issues (only if customer requires PO)
    if (job.customerPORequired === '1') {
      const jobPO = job.poNum?.trim()
      const proposalPO = job.proposalPO?.trim()

      // Both are empty - ISSUE
      if (!jobPO && !proposalPO) {
        return true
      }

      // Both have values but don't match - ISSUE
      if (jobPO && proposalPO && jobPO !== proposalPO) {
        return true
      }
    }

    // Check if past due by more than 14 days
    if (job.promiseDateTime) {
      const dueDate = new Date(job.promiseDateTime)
      const now = new Date()
      const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      if (daysDiff > 14) {
        return true // Past due by more than 14 days
      }
    }

    // Check if there are ChangeOrders (type 5001) with zero or missing price
    if (job.changeOrdersWithZeroPrice && job.changeOrdersWithZeroPrice > 0) {
      return true // Has ChangeOrders with zero/missing price
    }

    return false // No issues
  }

  // Get unique statuses for the filter dropdown
  const uniqueStatuses = Array.from(new Set(jobs.map(j => j.adminStatusDescription || j.adminStatus).filter(Boolean)))
    .sort()

  // Get unique CSRs for the filter dropdown
  const uniqueCSRs = Array.from(new Set(jobs.map(j => j.csrName || j.csr).filter(Boolean)))
    .sort()

  // Filter and sort jobs
  const filteredAndSortedJobs = jobs
    .filter(job => {
      // Dismissed filter - show ONLY dismissed OR ONLY active based on toggle
      if (showDismissedJobs) {
        // When toggle is ON, show ONLY dismissed jobs
        if (!job.isDismissed) return false
      } else {
        // When toggle is OFF, show ONLY active jobs
        if (job.isDismissed) return false
      }

      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const jobNumber = (job.job || '').toString().toLowerCase()
        const customerName = (job.customerName || job.customer || '').toString().toLowerCase()
        const description = (job.description || '').toString().toLowerCase()
        const proposalNumber = (job.u_proposal_number || '').toString().toLowerCase()
        const csrName = (job.csrName || job.csr || '').toString().toLowerCase()

        const matchesSearch = (
          jobNumber.includes(searchLower) ||
          customerName.includes(searchLower) ||
          description.includes(searchLower) ||
          proposalNumber.includes(searchLower) ||
          csrName.includes(searchLower)
        )

        if (!matchesSearch) return false
      }

      // Status filter
      if (statusFilter !== 'all') {
        const jobStatus = job.adminStatusDescription || job.adminStatus || ''
        if (jobStatus !== statusFilter) return false
      }

      // CSR filter
      if (csrFilter !== 'all') {
        const jobCSR = job.csrName || job.csr || ''
        if (jobCSR !== csrFilter) return false
      }

      // Issue Type filter
      if (issueTypeFilter !== 'all') {
        switch (issueTypeFilter) {
          case 'estimate':
            if (!hasEstimateIssue(job)) return false
            break
          case 'estimate_price':
            if (!hasEstimatePriceIssue(job)) return false
            break
          case 'sell_price':
            if (!hasSellPriceIssue(job)) return false
            break
          case 'po':
            if (!hasPOIssue(job)) return false
            break
          case 'past_due':
            if (!hasPastDueIssue(job)) return false
            break
          case 'change_order':
            if (!hasChangeOrderIssue(job)) return false
            break
          default:
            break
        }
      }

      // Issues filter
      if (showIssuesOnly && !jobHasIssues(job)) {
        return false
      }

      // Date filter
      return isDateInRange(job.promiseDateTime, dateFilter)
    })
    .sort((a, b) => {
      // When showing dismissed jobs, sort by dismissal date (most recent first)
      if (showDismissedJobs) {
        const aDismissedAt = a.activeDismissal?.dismissedAt ? new Date(a.activeDismissal.dismissedAt) : null
        const bDismissedAt = b.activeDismissal?.dismissedAt ? new Date(b.activeDismissal.dismissedAt) : null

        if (!aDismissedAt && !bDismissedAt) return 0
        if (!aDismissedAt) return 1
        if (!bDismissedAt) return -1

        // Most recent dismissals first
        return bDismissedAt.getTime() - aDismissedAt.getTime()
      }

      // For active jobs, use the selected sort field
      // Special handling for date sorting
      if (sortField === 'promiseDateTime') {
        const aDate = a.promiseDateTime ? new Date(a.promiseDateTime) : null
        const bDate = b.promiseDateTime ? new Date(b.promiseDateTime) : null

        // Handle null dates - push them to the end regardless of sort order
        if (!aDate && !bDate) return 0
        if (!aDate) return 1 // a goes to end
        if (!bDate) return -1 // b goes to end

        // Compare valid dates
        const comparison = aDate.getTime() - bDate.getTime()
        return sortOrder === 'asc' ? comparison : -comparison
      }

      // Handle all other field types
      let aValue: string
      let bValue: string

      switch (sortField) {
        case 'job':
          aValue = a.job || ''
          bValue = b.job || ''
          break
        case 'reference':
          // Changed to proposal number
          aValue = a.u_proposal_number || ''
          bValue = b.u_proposal_number || ''
          break
        case 'customer':
          aValue = a.customerName || a.customer || ''
          bValue = b.customerName || b.customer || ''
          break
        case 'adminStatus':
          aValue = a.adminStatusDescription || a.adminStatus || ''
          bValue = b.adminStatusDescription || b.adminStatus || ''
          break
        default:
          return 0
      }

      // String comparison
      const comparison = aValue.localeCompare(bValue)
      return sortOrder === 'asc' ? comparison : -comparison
    })

  // Calculate pagination
  const totalPages = Math.ceil(filteredAndSortedJobs.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedJobs = filteredAndSortedJobs.slice(startIndex, endIndex)

  const handleJobClick = (job: Job) => {
    setSelectedJob(job)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedJob(null)
    setEstimateAlertMessage(null)
    setModalTab('details')
  }

  const handleSendEstimateAlert = async () => {
    if (!selectedJob || !selectedJob.plannerEmail) {
      setEstimateAlertMessage({
        type: 'error',
        text: 'Cannot send alert: Planner email not available'
      })
      return
    }

    setSendingEstimateAlert(true)
    setEstimateAlertMessage(null)

    try {
      const response = await fetch('/api/pace/jobs/send-estimate-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobNumber: selectedJob.job,
          proposalNumber: selectedJob.u_proposal_number,
          proposalEstimate: selectedJob.proposalEstimate,
          part1Estimate: selectedJob.part1Estimate,
          plannerEmail: selectedJob.plannerEmail,
          plannerName: selectedJob.plannerName,
          customerName: selectedJob.customerName,
          description: selectedJob.description,
        })
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setEstimateAlertMessage({
          type: 'success',
          text: `Alert email sent successfully to ${selectedJob.plannerName || selectedJob.plannerEmail}`
        })
      } else {
        throw new Error(result.error || 'Failed to send alert email')
      }
    } catch (err) {
      setEstimateAlertMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'An error occurred while sending alert email'
      })
    } finally {
      setSendingEstimateAlert(false)
    }
  }

  const navigateToNextJob = () => {
    if (!selectedJob) return
    const currentIndex = paginatedJobs.findIndex(job => job.job === selectedJob.job)
    if (currentIndex < paginatedJobs.length - 1) {
      setSelectedJob(paginatedJobs[currentIndex + 1])
    }
  }

  const navigateToPreviousJob = () => {
    if (!selectedJob) return
    const currentIndex = paginatedJobs.findIndex(job => job.job === selectedJob.job)
    if (currentIndex > 0) {
      setSelectedJob(paginatedJobs[currentIndex - 1])
    }
  }

  const getCurrentJobIndex = () => {
    if (!selectedJob) return { current: 0, total: 0 }
    const currentIndex = paginatedJobs.findIndex(job => job.job === selectedJob.job)
    return {
      current: currentIndex + 1,
      total: paginatedJobs.length
    }
  }

  // Render sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }

    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 py-4 flex-shrink-0">
        <div className="flex items-center justify-between px-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Prebilling Jobs</h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-gray-500">
                {loading ? (
                  'Loading jobs...'
                ) : filteredAndSortedJobs.length > 0 ? (
                  <>
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredAndSortedJobs.length)} of {filteredAndSortedJobs.length} open {filteredAndSortedJobs.length === 1 ? 'job' : 'jobs'}
                    {searchTerm && ` (filtered from ${jobs.length} total)`}
                  </>
                ) : (
                  'All jobs with StatusType != 5'
                )}
              </p>
              {lastFetchTime && (
                <span
                  className="text-xs text-gray-500 flex items-center gap-1 px-2 py-1 bg-gray-50 rounded border border-gray-200"
                  title={`Last updated: ${lastFetchTime.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                  })}`}
                >
                  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Updated {getTimeAgo(lastFetchTime)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Search Bar and Buttons */}
          <div className="flex items-center gap-3">
            {canSyncPrices && (
              <>
                {!activeAction ? (
                  /* Show action selector buttons when no action is active */
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveAction('prices')}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Update Prices
                    </button>
                    <button
                      onClick={() => setActiveAction('duedates')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Update Due Dates
                    </button>
                  </div>
                ) : (
                  /* Show action buttons when an action is active */
                  <div className="flex gap-2 items-center">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">
                        {activeAction === 'prices' ? 'Updating Prices' : 'Updating Due Dates'}
                      </span>
                      <span className="text-sm text-gray-500">
                        ({selectedJobIds.size} selected)
                      </span>
                    </div>
                    {selectedJobIds.size > 0 && (
                      <button
                        onClick={() => {
                          if (activeAction === 'prices') {
                            setShowSyncConfirmation(true)
                          } else {
                            setShowDueDateModal(true)
                          }
                        }}
                        disabled={isSyncing}
                        className={`px-4 py-2 ${activeAction === 'prices' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {isSyncing ? 'Updating...' : 'Apply'}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setActiveAction(null)
                        setSelectedJobIds(new Set())
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </>
            )}
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search jobs..."
                className="w-80 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              onClick={fetchOpenJobs}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar - Date and Status */}
      <div className="bg-white border-b border-gray-200 pl-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            {/* Date Filter - Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700 mr-2">Due Date:</span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white w-auto max-w-[160px]"
              >
                <option value="all">All</option>
                <option value="pastdue">Past Due</option>
                <option value="thisweek">Next 7 Days</option>
                <option value="thismonth">This Month</option>
                <option value="future">Future</option>
              </select>
              {dateFilter !== 'all' && (
                <button
                  onClick={() => setDateFilter('all')}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                  title="Clear date filter"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2 border-l border-gray-300 pl-6">
              <span className="text-sm font-medium text-gray-700 mr-2">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="all">All Statuses</option>
                {uniqueStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              {statusFilter !== 'all' && (
                <button
                  onClick={() => setStatusFilter('all')}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                  title="Clear status filter"
                >
                  Clear
                </button>
              )}
            </div>

            {/* CSR Filter */}
            <div className="flex items-center gap-2 border-l border-gray-300 pl-6">
              <span className="text-sm font-medium text-gray-700 mr-2">CSR:</span>
              <select
                value={csrFilter}
                onChange={(e) => setCSRFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="all">All CSRs</option>
                {uniqueCSRs.map((csr) => (
                  <option key={csr} value={csr}>
                    {csr}
                  </option>
                ))}
              </select>
              {csrFilter !== 'all' && (
                <button
                  onClick={() => setCSRFilter('all')}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                  title="Clear CSR filter"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Issue Type Filter */}
            <div className="flex items-center gap-2 border-l border-gray-300 pl-6">
              <span className="text-sm font-medium text-gray-700 mr-2">Issue Type:</span>
              <select
                value={issueTypeFilter}
                onChange={(e) => setIssueTypeFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="all">All Issues</option>
                <option value="estimate">Estimate #</option>
                <option value="estimate_price">Estimate Price</option>
                <option value="sell_price">Sell Price</option>
                <option value="po">PO Missing/Mismatch</option>
                <option value="past_due">Past Due</option>
                <option value="change_order">Change Orders</option>
              </select>
              {issueTypeFilter !== 'all' && (
                <button
                  onClick={() => setIssueTypeFilter('all')}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                  title="Clear issue type filter"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Show Dismissed Toggle */}
            {(() => {
              const dismissedCount = jobs.filter(j => j.isDismissed).length
              if (dismissedCount === 0) return null
              return (
                <div className="flex items-center gap-2 border-l border-gray-300 pl-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showDismissedJobs}
                      onChange={(e) => setShowDismissedJobs(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      View dismissed jobs only
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded-full">
                        {dismissedCount}
                      </span>
                    </span>
                  </label>
                </div>
              )
            })()}
          </div>

          {/* Pagination Controls - Compact version */}
          {filteredAndSortedJobs.length > 0 && (
            <div className="flex items-center gap-3 border-l border-gray-300 pl-6">
              {/* Items per page */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">Show</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>

              {/* Page info */}
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>

              {/* Navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="First page"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Previous"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Next"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Last page"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sync message */}
        {syncMessage && (
          <div className={`mx-6 mt-4 px-4 py-3 rounded-lg flex items-center justify-between ${
            syncMessage.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                {syncMessage.type === 'success' ? (
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                ) : (
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                )}
              </svg>
              {syncMessage.text}
            </div>
            <button
              onClick={() => setSyncMessage(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-gray-600 font-medium">Loading open jobs...</p>
              <p className="text-gray-400 text-sm mt-1">This may take a moment</p>
            </div>
          </div>
        ) : filteredAndSortedJobs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'No jobs match your search' : 'No open jobs found'}
              </h3>
              <p className="text-gray-500">
                {searchTerm
                  ? 'Try adjusting your search criteria'
                  : 'There are currently no jobs with StatusType = 5'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Table Container with Overflow */}
            <div className="flex-1 overflow-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {canSyncPrices && activeAction && (
                      <th className="pl-6 pr-2 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 w-12">
                        <input
                          type="checkbox"
                          checked={
                            selectedJobIds.size > 0 &&
                            selectedJobIds.size === (activeAction === 'prices'
                              ? paginatedJobs.filter(job => job.proposalTotalSellPrice).length
                              : paginatedJobs.length)
                          }
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </th>
                    )}
                    <th
                      onClick={() => handleSort('job')}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Job #
                        <SortIcon field="job" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('reference')}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Proposal #
                        <SortIcon field="reference" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('customer')}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Customer
                        <SortIcon field="customer" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      CSR
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      Description
                    </th>
                    <th
                      onClick={() => handleSort('promiseDateTime')}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        Due Date
                        <SortIcon field="promiseDateTime" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      Estimate
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      Estimate Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      Sell Price
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                      Issues
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 w-20">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {paginatedJobs.map((job, index) => {
                    // Check if this is a dismissed job
                    const isDismissedJob = job.isDismissed

                    // All jobs now render in full table format
                    return (
                    <React.Fragment key={job.job || index}>
                    <tr
                      onClick={() => handleJobClick(job)}
                      className={`cursor-pointer transition-colors group ${
                        isDismissedJob
                          ? 'bg-blue-50/30 hover:bg-blue-50'
                          : 'hover:bg-blue-50 border-b border-gray-100'
                      }`}
                    >
                      {canSyncPrices && activeAction && (
                        <td className="pl-6 pr-2 py-3 text-sm w-12" onClick={(e) => e.stopPropagation()}>
                          {activeAction === 'prices' && !job.proposalTotalSellPrice ? (
                            <span className="text-gray-400 text-xs">N/A</span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={selectedJobIds.has(job.job!)}
                              onChange={(e) => handleSelectJob(job.job!, e.target.checked)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm cursor-pointer" onClick={() => handleJobClick(job)}>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-blue-600 group-hover:text-blue-700">
                              {job.job || '-'}
                            </span>
                            {isDismissedJob && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300">
                                Dismissed
                              </span>
                            )}
                          </div>
                          {(job.adminStatusDescription || job.adminStatus) && (
                            <span className="text-xs text-gray-500">
                              {job.adminStatusDescription || job.adminStatus}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-medium text-gray-900">
                          {job.u_proposal_number || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px]">
                        <div className="truncate">
                          {job.customerName || job.customer || <span className="text-gray-400">-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {getFirstName(job.csrName || job.csr) || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                        <div
                          className="line-clamp-2 whitespace-normal break-words"
                          title={job.description || undefined}
                        >
                          {job.description || <span className="text-gray-400">-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {job.promiseDateTime ? (
                          <span>{new Date(job.promiseDateTime).toLocaleDateString('en-US', {
                            month: 'numeric',
                            day: 'numeric',
                            year: '2-digit'
                          })}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {(() => {
                          // If both values exist and are exactly equal, show single value
                          if (job.proposalEstimate && job.part1Estimate &&
                              job.proposalEstimate === job.part1Estimate) {
                            return (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                {job.part1Estimate}
                              </span>
                            )
                          }
                          // If values differ or one is missing, show both with labels
                          if (job.proposalEstimate || job.part1Estimate) {
                            return (
                              <div className="flex flex-col gap-0.5 text-xs">
                                {/* Proposal Estimate - FIRST */}
                                {job.proposalEstimate ? (
                                  <div className="whitespace-nowrap">
                                    <span className="font-medium text-gray-600">P: </span>
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded font-medium bg-blue-100 text-blue-800">
                                      {job.proposalEstimate}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="whitespace-nowrap">
                                    <span className="font-medium text-gray-600">P: </span>
                                    <span className="text-gray-400">-</span>
                                  </div>
                                )}

                                {/* Job Part 1 Estimate - SECOND */}
                                {job.part1Estimate ? (
                                  <div className="whitespace-nowrap">
                                    <span className="font-medium text-gray-600">J: </span>
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded font-medium bg-purple-100 text-purple-800">
                                      {job.part1Estimate}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="whitespace-nowrap">
                                    <span className="font-medium text-gray-600">J: </span>
                                    <span className="text-gray-400">-</span>
                                  </div>
                                )}
                              </div>
                            )
                          }
                          return <span className="text-gray-400">-</span>
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {(() => {
                          // If both values exist and difference is within acceptable range ($100), show only Job value
                          if (job.jobValue && job.proposalEstimatePrice &&
                              Math.abs(job.jobValue - job.proposalEstimatePrice) <= 100) {
                            return (
                              <span className="font-semibold text-sm tabular-nums">
                                ${job.jobValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )
                          }
                          // If values differ by more than $100 or one is missing, show both with labels
                          if (job.jobValue || job.proposalEstimatePrice) {
                            return (
                              <div className="flex flex-col gap-0.5">
                                {/* Proposal Estimate Price - FIRST */}
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-medium text-gray-600">P:</span>
                                  {job.proposalEstimatePrice ? (
                                    <span className="font-semibold text-xs tabular-nums">
                                      ${job.proposalEstimatePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                </div>

                                {/* Job Value - SECOND */}
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-medium text-gray-600">J:</span>
                                  {job.jobValue ? (
                                    <span className="font-semibold text-xs tabular-nums">
                                      ${job.jobValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                </div>
                              </div>
                            )
                          }
                          return <span className="text-gray-400">-</span>
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {(() => {
                          // If both values exist and are equal, show single value
                          if (job.amountToInvoice && job.proposalTotalSellPrice &&
                              Math.abs(job.amountToInvoice - job.proposalTotalSellPrice) <= 0.01) {
                            return (
                              <span className="font-semibold text-sm tabular-nums">
                                ${job.amountToInvoice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            )
                          }
                          // If values differ or one is missing, show both with labels
                          if (job.proposalTotalSellPrice || job.amountToInvoice) {
                            return (
                              <div className="flex flex-col gap-0.5">
                                {/* Proposal Total Sell Price - FIRST */}
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-medium text-gray-600">P:</span>
                                  {job.proposalTotalSellPrice ? (
                                    <span className="font-semibold text-xs tabular-nums">
                                      ${job.proposalTotalSellPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                </div>

                                {/* Amount to Invoice - SECOND */}
                                <div className="flex items-center gap-1">
                                  <span className="text-xs font-medium text-gray-600">J:</span>
                                  {job.amountToInvoice ? (
                                    <span className="font-semibold text-xs tabular-nums">
                                      ${job.amountToInvoice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                </div>
                              </div>
                            )
                          }
                          return <span className="text-gray-400">-</span>
                        })()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {/* Issues Column - Display problems */}
                        <div className="flex flex-col gap-0.5">
                          {/* Estimate Number Mismatch Issue */}
                          {(() => {
                            // Check for missing estimate values
                            if (!job.proposalEstimate && !job.part1Estimate) {
                              return (
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-gray-500">No Estimate # data</span>
                                </div>
                              )
                            }
                            if (!job.proposalEstimate) {
                              return (
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-yellow-700">Missing proposal estimate #</span>
                                </div>
                              )
                            }
                            if (!job.part1Estimate) {
                              return (
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-yellow-700">Missing job estimate #</span>
                                </div>
                              )
                            }
                            // Both values exist, check if they differ (exact match required)
                            if (job.proposalEstimate !== job.part1Estimate) {
                              return (
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-red-700">Estimate # mismatch</span>
                                </div>
                              )
                            }
                            return null
                          })()}

                          {/* Job Value vs Proposal Estimate Price Issue */}
                          {(() => {
                            // Check for missing values
                            if (!job.proposalEstimatePrice && !job.jobValue) {
                              return (
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-gray-500">No Estimate Price data</span>
                                </div>
                              )
                            }
                            if (!job.proposalEstimatePrice) {
                              return (
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-yellow-700">Missing proposal EP</span>
                                </div>
                              )
                            }
                            if (!job.jobValue) {
                              return (
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-yellow-700">Missing job value</span>
                                </div>
                              )
                            }
                            // Both values exist, check difference
                            const diff = Math.abs(job.jobValue - job.proposalEstimatePrice)
                            if (diff > 100) {
                              return (
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-red-700">Value diff: ${diff.toFixed(2)}</span>
                                </div>
                              )
                            }
                            return null
                          })()}

                          {/* Amount to Invoice vs Proposal Total Sell Price Issue */}
                          {(() => {
                            // Check for missing values
                            if (!job.proposalTotalSellPrice && !job.amountToInvoice) {
                              return (
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-gray-500">No Sell Price data</span>
                                </div>
                              )
                            }
                            if (!job.proposalTotalSellPrice) {
                              return (
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-yellow-700">Missing proposal sell price</span>
                                </div>
                              )
                            }
                            if (!job.amountToInvoice) {
                              return (
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <svg className="w-4 h-4 text-yellow-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-yellow-700">Missing amount to invoice</span>
                                </div>
                              )
                            }
                            // Both values exist, check if different
                            const diff = Math.abs(job.amountToInvoice - job.proposalTotalSellPrice)
                            if (diff > 0.01) { // Allow for tiny floating point differences
                              return (
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-orange-700">Sell Price diff: ${diff.toFixed(2)}</span>
                                </div>
                              )
                            }
                            return null
                          })()}

                          {/* PO Issue - Only check if customer requires PO */}
                          {(() => {
                            // Only validate PO if customer requires it (1 = required)
                            if (job.customerPORequired !== '1') {
                              return null
                            }

                            const jobPO = job.poNum?.trim()
                            const proposalPO = job.proposalPO?.trim()

                            // Both are empty - ISSUE
                            if (!jobPO && !proposalPO) {
                              return (
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-red-700">Missing PO (required)</span>
                                </div>
                              )
                            }

                            // Both have values but don't match - ISSUE
                            if (jobPO && proposalPO && jobPO !== proposalPO) {
                              return (
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-red-700">PO mismatch: Job({jobPO}) ≠ Prop({proposalPO})</span>
                                </div>
                              )
                            }

                            // One has value, other is empty - OK, no issue shown
                            return null
                          })()}

                          {/* Past Due Issue - More than 14 days */}
                          {(() => {
                            if (!job.promiseDateTime) {
                              return null
                            }

                            const dueDate = new Date(job.promiseDateTime)
                            const now = new Date()
                            const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

                            if (daysDiff > 14) {
                              return (
                                <div className="flex items-center gap-1 whitespace-nowrap">
                                  <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                  </svg>
                                  <span className="text-xs text-red-700">Past due {daysDiff} days</span>
                                </div>
                              )
                            }

                            return null
                          })()}

                          {/* ChangeOrder with Zero/Missing Price Issue */}
                          {(() => {
                            if (!job.changeOrdersWithZeroPrice || job.changeOrdersWithZeroPrice === 0) {
                              return null
                            }

                            const count = job.changeOrdersWithZeroPrice
                            const message = count === 1
                              ? '1 CO w/ $0'
                              : `${count} COs w/ $0`

                            return (
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs text-red-700">{message}</span>
                              </div>
                            )
                          })()}
                        </div>
                      </td>
                      {/* Actions Column */}
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {isDismissedJob ? (
                            <button
                              onClick={() => handleUndismissJob(job)}
                              className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-all duration-200 shadow-sm hover:shadow"
                              title="Restore this job to active status"
                            >
                              <div className="flex items-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Restore</span>
                              </div>
                            </button>
                          ) : canDismissJob(job) ? (
                            <button
                              onClick={() => {
                                setSelectedJobForDismiss(job)
                                setShowDismissModal(true)
                              }}
                              className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                              title="Dismiss for 72 hours"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {/* Full-width dismissal note row */}
                    {isDismissedJob && job.activeDismissal && (
                      <tr className="border-b border-gray-100 bg-blue-50/30">
                        <td colSpan={canSyncPrices && activeAction ? 11 : 10} className="px-6 py-3">
                          <div className="flex items-start gap-3 bg-gradient-to-r from-amber-50 to-amber-100/50 px-4 py-3 rounded-lg border border-amber-200">
                            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-amber-900">Dismissal Note</span>
                                <span className="text-xs text-amber-700">
                                  by {job.activeDismissal.dismissedByName} • {new Date(job.activeDismissal.dismissedAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              <p className="text-sm text-amber-900 leading-relaxed">
                                "{job.activeDismissal.note}"
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Job Details Modal */}
      {isModalOpen && selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Job Details</h2>
                    <p className="text-sm text-gray-600 mt-0.5 font-mono">#{selectedJob.job}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Navigation Buttons */}
                  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
                    <button
                      onClick={navigateToPreviousJob}
                      disabled={getCurrentJobIndex().current === 1}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Previous job"
                    >
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center">
                      {getCurrentJobIndex().current} of {getCurrentJobIndex().total}
                    </span>
                    <button
                      onClick={navigateToNextJob}
                      disabled={getCurrentJobIndex().current === getCurrentJobIndex().total}
                      className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Next job"
                    >
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                  <button
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-3 border-b border-gray-200 bg-white">
              <div className="flex gap-1">
                <button
                  onClick={() => setModalTab('details')}
                  className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                    modalTab === 'details'
                      ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Job Details
                  </span>
                </button>
                <button
                  onClick={() => setModalTab('dismissals')}
                  className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                    modalTab === 'dismissals'
                      ? 'bg-amber-50 text-amber-700 border-b-2 border-amber-600'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Dismiss History
                    {selectedJob.dismissalHistory && selectedJob.dismissalHistory.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-amber-200 text-amber-800 rounded-full">
                        {selectedJob.dismissalHistory.length}
                      </span>
                    )}
                  </span>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Details Tab */}
              {modalTab === 'details' && (
                <>
              {/* Estimates */}
              <section className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Estimates
                </h3>

                {/* Compact 3-column layout */}
                <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-3 items-start">
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Proposal Estimate #</label>
                    <p className="text-sm font-semibold text-gray-900">{selectedJob.proposalEstimate || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 block mb-1">Job Estimate #</label>
                    <p className="text-sm font-semibold text-gray-900">{selectedJob.part1Estimate || '-'}</p>
                  </div>
                  <div>
                    {selectedJob.proposalEstimate && selectedJob.part1Estimate && selectedJob.proposalEstimate !== selectedJob.part1Estimate ? (
                      <div className="space-y-2">
                        <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start gap-1.5 text-red-700">
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <p className="text-xs font-semibold">Estimate numbers don't match</p>
                          </div>
                        </div>
                        {selectedJob.plannerEmail && (
                          <button
                            onClick={handleSendEstimateAlert}
                            disabled={sendingEstimateAlert}
                            className="w-full px-3 py-1.5 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 font-medium"
                            title="Send alert email to planner"
                          >
                            {sendingEstimateAlert ? (
                              <>
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Sending...
                              </>
                            ) : (
                              <>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Alert Planner
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 text-xs text-gray-500 italic">No issues</div>
                    )}
                  </div>
                </div>
              </section>

              {/* Email Alert Message */}
              {estimateAlertMessage && (
                <div className={`p-4 rounded-lg border ${
                  estimateAlertMessage.type === 'success'
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div className="flex items-start gap-3">
                    {estimateAlertMessage.type === 'success' ? (
                      <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{estimateAlertMessage.text}</p>
                    </div>
                    <button
                      onClick={() => setEstimateAlertMessage(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Financial Information */}
              <section className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Financial Information
                </h3>

                {/* Compact 3-column comparison layout */}
                <div className="space-y-2">
                  {/* Row 1: Proposal Estimate Price vs Job Value */}
                  <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-3 items-start">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Proposal Estimate Price</label>
                      <p className="text-sm font-semibold text-gray-900">
                        {selectedJob.proposalEstimatePrice
                          ? `$${selectedJob.proposalEstimatePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Job Value</label>
                      <p className="text-sm font-semibold text-gray-900">
                        {selectedJob.jobValue
                          ? `$${selectedJob.jobValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '-'}
                      </p>
                    </div>
                    <div>
                      {selectedJob.jobValue && selectedJob.proposalEstimatePrice &&
                       Math.abs(selectedJob.jobValue - selectedJob.proposalEstimatePrice) > 100 ? (
                        <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start gap-1.5 text-red-700">
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div className="text-xs">
                              <p className="font-semibold">Price mismatch</p>
                              <p className="mt-0.5">
                                Diff: ${Math.abs(selectedJob.jobValue - selectedJob.proposalEstimatePrice).toFixed(2)}
                                {selectedJob.jobValue < selectedJob.proposalEstimatePrice ? ' (lower)' : ' (higher)'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 text-xs text-gray-500 italic">No issues</div>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-green-200 my-2"></div>

                  {/* Row 2: Proposal Total Sell Price vs Amount to Invoice */}
                  <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-3 items-start">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Proposal Total Sell Price</label>
                      <p className="text-sm font-semibold text-gray-900">
                        {selectedJob.proposalTotalSellPrice
                          ? `$${selectedJob.proposalTotalSellPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Amount to Invoice</label>
                      <p className="text-sm font-semibold text-gray-900">
                        {selectedJob.amountToInvoice
                          ? `$${selectedJob.amountToInvoice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : '-'}
                      </p>
                    </div>
                    <div>
                      {selectedJob.proposalTotalSellPrice && selectedJob.amountToInvoice &&
                       Math.abs(selectedJob.proposalTotalSellPrice - selectedJob.amountToInvoice) > 0.01 ? (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-start gap-1.5 text-amber-800">
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div className="text-xs">
                              <p className="font-semibold">Sell Price mismatch</p>
                              <p className="mt-0.5">
                                Diff: ${Math.abs(selectedJob.proposalTotalSellPrice - selectedJob.amountToInvoice).toFixed(2)}
                                {selectedJob.amountToInvoice < selectedJob.proposalTotalSellPrice ? ' (lower)' : ' (higher)'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 text-xs text-gray-500 italic">No issues</div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* PO Information */}
              {selectedJob.customerPORequired === '1' && (
                <section className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-5 border border-amber-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Purchase Order
                  </h3>

                  {/* Compact 3-column layout */}
                  <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-3 items-start">
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Job PO Number</label>
                      <p className="text-sm font-semibold text-gray-900">{selectedJob.poNum || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 block mb-1">Proposal PO Number</label>
                      <p className="text-sm font-semibold text-gray-900">{selectedJob.proposalPO || '-'}</p>
                    </div>
                    <div>
                      {(!selectedJob.poNum?.trim() && !selectedJob.proposalPO?.trim()) ? (
                        <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start gap-1.5 text-red-700">
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <p className="text-xs font-semibold">PO required but missing</p>
                          </div>
                        </div>
                      ) : selectedJob.poNum?.trim() && selectedJob.proposalPO?.trim() && selectedJob.poNum !== selectedJob.proposalPO ? (
                        <div className="p-2 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start gap-1.5 text-red-700">
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <p className="text-xs font-semibold">PO numbers don't match</p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 text-xs text-gray-500 italic">No issues</div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Change Orders */}
              {(Number(selectedJob.changeOrdersWithZeroPrice) > 0) && (
                <section className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-5 border border-red-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Change Orders
                  </h3>
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium">
                        {Number(selectedJob.changeOrdersWithZeroPrice) === 1
                          ? '1 Change Order with zero/missing price'
                          : `${selectedJob.changeOrdersWithZeroPrice} Change Orders with zero/missing price`}
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* Basic Information */}
              <section className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Basic Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Job Number</label>
                    <p className="text-base font-semibold text-gray-900">{selectedJob.job || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Proposal Number</label>
                    <p className="text-base font-semibold text-gray-900">{selectedJob.u_proposal_number || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Customer</label>
                    <p className="text-base font-semibold text-gray-900">{selectedJob.customerName || selectedJob.customer || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">CSR</label>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-base font-semibold text-gray-900">{getFirstName(selectedJob.csrName || selectedJob.csr) || '-'}</p>
                      {selectedJob.csrEmail && (
                        <a
                          href={`mailto:${selectedJob.csrEmail}`}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {selectedJob.csrEmail}
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Planner</label>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-base font-semibold text-gray-900">{selectedJob.plannerName || selectedJob.u_planner || '-'}</p>
                      {selectedJob.plannerEmail && (
                        <a
                          href={`mailto:${selectedJob.plannerEmail}`}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {selectedJob.plannerEmail}
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <p className="text-base font-semibold text-gray-900">{selectedJob.adminStatusDescription || selectedJob.adminStatus || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Job Type</label>
                    <p className="text-base font-semibold text-gray-900">{selectedJob.jobTypeDescription || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-500">Description</label>
                    <p className="text-base text-gray-900">{selectedJob.description || '-'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Due Date</label>
                    {selectedJob.promiseDateTime ? (
                      (() => {
                        const dueDate = new Date(selectedJob.promiseDateTime)
                        const now = new Date()
                        const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
                        const isPastDue = daysDiff > 14

                        return (
                          <div className="flex items-center gap-2">
                            <p className={`text-base font-semibold ${isPastDue ? 'text-red-600' : 'text-gray-900'}`}>
                              {dueDate.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                            {isPastDue && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-800 text-xs rounded-lg font-semibold">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                {daysDiff} days overdue 
                              </span>
                            )}
                          </div>
                        )
                      })()
                    ) : (
                      <p className="text-base font-semibold text-gray-900">-</p>
                    )}
                  </div>
                </div>
              </section>
                </>
              )}

              {/* Dismissals Tab */}
              {modalTab === 'dismissals' && (
                <div className="space-y-4">
                  {selectedJob.dismissalHistory && selectedJob.dismissalHistory.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Dismissal History ({selectedJob.dismissalHistory.length})
                        </h3>
                        {selectedJob.isDismissed && (
                          <span className="px-3 py-1 bg-amber-100 text-amber-800 text-sm font-medium rounded-full flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Currently Dismissed
                          </span>
                        )}
                      </div>
                      <div className="space-y-3">
                        {selectedJob.dismissalHistory.map((dismissal, index) => {
                          const isActive = !dismissal.isExpired
                          const dismissedDate = new Date(dismissal.dismissedAt)
                          const expiresDate = new Date(dismissal.expiresAt)

                          return (
                            <div
                              key={dismissal.id || index}
                              className={`rounded-xl border p-4 ${
                                isActive
                                  ? 'bg-amber-50 border-amber-200'
                                  : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                                      isActive
                                        ? 'bg-amber-200 text-amber-800'
                                        : 'bg-gray-200 text-gray-600'
                                    }`}>
                                      {isActive ? 'Active' : 'Expired'}
                                    </span>
                                    <span className="text-sm text-gray-600">
                                      by <span className="font-medium text-gray-900">{dismissal.dismissedByName}</span>
                                    </span>
                                  </div>
                                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                                    <p className="text-gray-700 whitespace-pre-wrap">{dismissal.note}</p>
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                                <div className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  Dismissed: {dismissedDate.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                  })}
                                </div>
                                <div className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {isActive ? 'Expires' : 'Expired'}: {expiresDate.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit'
                                  })}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-1">No Dismissal History</h3>
                      <p className="text-gray-500">This job has never been dismissed.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
              <div className="flex gap-3">
                {selectedJob.job && (
                  <a
                    href={`http://epace.calitho.com/epace/company:public/object/Job/detail/${selectedJob.job}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Go to Job
                  </a>
                )}
                {selectedJob.u_proposal_number && (
                  <a
                    href={`http://epace.calitho.com/epace/company:public/object/UDO_proposal/detail/${selectedJob.u_proposal_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-md font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Go to Proposal
                  </a>
                )}
              </div>
              <button
                onClick={closeModal}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Price Update Confirmation Modal */}
      {showSyncConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Update Prices</h3>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {selectedJobIds.size} job{selectedJobIds.size > 1 ? 's' : ''} selected
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSyncConfirmation(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Info Section */}
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 mb-1">What will be updated?</p>
                    <p className="text-sm text-gray-700">
                      The <code className="bg-white px-1.5 py-0.5 rounded text-xs font-mono border border-green-300">amountToInvoice</code> field will be set to match the <strong>Proposal Total Sell Price</strong> for each job in PACE.
                    </p>
                  </div>
                </div>
              </div>

              {/* Jobs Checklist */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Jobs to Update
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  {jobs.filter(job => selectedJobIds.has(job.job!)).map((job, index) => (
                      <div
                        key={job.job}
                        className={`p-3 ${index !== 0 ? 'border-t border-gray-100' : ''} hover:bg-gray-50 transition-colors`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-semibold text-blue-600 text-sm">
                                {job.job}
                              </span>
                              <span className="text-xs text-gray-500 truncate">
                                {job.customerName || job.customer}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <div className="flex items-center gap-1">
                                <span className="text-gray-500">Proposal Price:</span>
                                <span className="font-semibold text-green-700">
                                  ${job.proposalTotalSellPrice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              {job.amountToInvoice !== undefined && job.amountToInvoice !== job.proposalTotalSellPrice && (
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-500">Current Invoice:</span>
                                  <span className="font-medium text-gray-700">
                                    ${job.amountToInvoice?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                                  </span>
                                </div>
                              )}
                            </div>
                            {/* Issues */}

                          </div>
                          <div className="flex-shrink-0">
                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                This action will update PACE immediately
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSyncConfirmation(false)}
                  className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSyncPrices}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Update {selectedJobIds.size} Job{selectedJobIds.size > 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Due Date Update Modal */}
      {showDueDateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Update Due Dates</h3>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {selectedJobIds.size} job{selectedJobIds.size > 1 ? 's' : ''} selected
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDueDateModal(false)
                    setSelectedDueDate('')
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Date Picker Section */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <label htmlFor="dueDate" className="block text-sm font-semibold text-gray-900 mb-3">
                  New Due Date
                </label>
                <input
                  type="date"
                  id="dueDate"
                  value={selectedDueDate}
                  onChange={(e) => setSelectedDueDate(e.target.value)}
                  className="w-full px-4 py-3 text-lg border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                />
                <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Time will be set to end of business day (5:00 PM)
                </p>
              </div>

              {/* Jobs Checklist */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Jobs to Update
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  {jobs.filter(job => selectedJobIds.has(job.job!)).map((job, index) => {
                    const currentDate = job.promiseDateTime
                      ? new Date(job.promiseDateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : 'Not set'

                    return (
                      <div
                        key={job.job}
                        className={`p-3 ${index !== 0 ? 'border-t border-gray-100' : ''} hover:bg-gray-50 transition-colors`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-semibold text-blue-600 text-sm">
                                {job.job}
                              </span>
                              <span className="text-xs text-gray-500 truncate">
                                {job.customerName || job.customer}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500">Current:</span>
                              <span className={`font-medium ${!job.promiseDateTime ? 'text-red-600' : 'text-gray-700'}`}>
                                {currentDate}
                              </span>
                              {selectedDueDate && (
                                <>
                                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                  <span className="text-blue-600 font-semibold">
                                    {new Date(selectedDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                </>
                              )}
                            </div>
                         
                          </div>
                          <div className="flex-shrink-0">
                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Changes will be applied to all selected jobs
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDueDateModal(false)
                    setSelectedDueDate('')
                  }}
                  className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSyncDueDates}
                  disabled={!selectedDueDate}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium shadow-sm flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Update {selectedJobIds.size} Job{selectedJobIds.size > 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dismiss Modal */}
      {showDismissModal && selectedJobForDismiss && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-orange-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Dismiss Job #{selectedJobForDismiss.job}</h3>
                    <p className="text-sm text-gray-500">{selectedJobForDismiss.customerName || selectedJobForDismiss.customer}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDismissModal(false)
                    setSelectedJobForDismiss(null)
                    setDismissNote('')
                  }}
                  className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-4">
              <textarea
                value={dismissNote}
                onChange={(e) => setDismissNote(e.target.value)}
                placeholder="Why are you dismissing this job?"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none text-sm"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                This job will be hidden from daily emails for 72 hours.
              </p>

              {/* Dismissal History */}
              {selectedJobForDismiss.dismissalHistory && selectedJobForDismiss.dismissalHistory.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    Previous Dismissals ({selectedJobForDismiss.dismissalHistory.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {selectedJobForDismiss.dismissalHistory.map((d, i) => (
                      <div key={d.id || i} className="text-xs bg-gray-50 p-2 rounded">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-700">{d.dismissedByName}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${d.isExpired ? 'bg-gray-200 text-gray-600' : 'bg-amber-100 text-amber-700'}`}>
                            {d.isExpired ? 'Expired' : 'Active'}
                          </span>
                        </div>
                        <p className="text-gray-600 mt-1">"{d.note}"</p>
                        <p className="text-gray-400 mt-1">
                          {new Date(d.dismissedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDismissModal(false)
                  setSelectedJobForDismiss(null)
                  setDismissNote('')
                }}
                disabled={dismissing}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDismissJob}
                disabled={dismissing || !dismissNote.trim()}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
              >
                {dismissing ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Dismissing...
                  </>
                ) : (
                  'Dismiss'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note Modal */}
      {showNoteModal && selectedJobForNote && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Edit Note</h3>
                    <p className="text-sm text-gray-600">Job #{selectedJobForNote.job}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowNoteModal(false)
                    setSelectedJobForNote(null)
                    setNoteText('')
                  }}
                  className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Note
                  </label>
                  <span className="text-xs text-gray-500">
                    {noteText.length} characters
                  </span>
                </div>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note for this job..."
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                />
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex gap-2">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">About Notes</p>
                    <p className="text-blue-700">This note will be saved to the <span className="font-mono text-xs">u_calithosuite_note</span> field in PACE and can be used to track important information about this job.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowNoteModal(false)
                  setSelectedJobForNote(null)
                  setNoteText('')
                }}
                disabled={savingNote}
                className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!selectedJobForNote?.job) return

                  setSavingNote(true)
                  try {
                    const response = await fetch('/api/pace/jobs/update-note', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        jobNumber: selectedJobForNote.job,
                        note: noteText
                      })
                    })

                    if (!response.ok) {
                      throw new Error('Failed to update note')
                    }

                    // Update local state
                    setJobs(prevJobs =>
                      prevJobs.map(j =>
                        j.job === selectedJobForNote.job
                          ? { ...j, u_calithosuite_note: noteText }
                          : j
                      )
                    )

                    // Update cache
                    const cachedData = localStorage.getItem('prebilling_jobs_cache')
                    if (cachedData) {
                      const parsed = JSON.parse(cachedData)
                      const updated = parsed.map((j: Job) =>
                        j.job === selectedJobForNote.job
                          ? { ...j, u_calithosuite_note: noteText }
                          : j
                      )
                      localStorage.setItem('prebilling_jobs_cache', JSON.stringify(updated))
                    }

                    setShowNoteModal(false)
                    setSelectedJobForNote(null)
                    setNoteText('')
                  } catch (error) {
                    console.error('Error updating note:', error)
                    alert('Failed to update note. Please try again.')
                  } finally {
                    setSavingNote(false)
                  }
                }}
                disabled={savingNote}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium shadow-sm flex items-center gap-2"
              >
                {savingNote ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Note
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
