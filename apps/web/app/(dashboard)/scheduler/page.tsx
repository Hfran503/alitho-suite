'use client'

import { useState, useEffect, useCallback } from 'react'

type Department = {
  id: string
  name: string
  color: string | null
}

type Equipment = {
  id: string
  name: string
  description: string | null
}

type ScheduledJob = {
  id: string
  paceJobNumber: string
  paceJobData: any
  departmentId: string
  equipmentId: string | null
  scheduledDate: string
  position: number
  status: string
  priority: string
  notes: string | null
  estimatedHours: number | null
  actualHours: number | null
  assignedToId: string | null
  Department: {
    id: string
    name: string
    color: string | null
  }
  Equipment: {
    id: string
    name: string
    description: string | null
  } | null
  User: {
    id: string
    name: string | null
    email: string
  } | null
}

type SchedulableJob = {
  jobNumber: string
  customer: string
  customerName: string | null
  description: string | null
  jobType: number
  jobTypeDescription: string | null
  promiseDateTime: string | null
  isScheduled: boolean
  paceJobData: any
}

export default function SchedulerPage() {
  // State
  const [departments, setDepartments] = useState<Department[]>([])
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('')
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('all')
  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([])
  const [schedulableJobs, setSchedulableJobs] = useState<SchedulableJob[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draggedJob, setDraggedJob] = useState<ScheduledJob | null>(null)
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null)
  const [dragOverEquipmentId, setDragOverEquipmentId] = useState<string | null>(null)
  const [dragOverPosition, setDragOverPosition] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [pendingChanges, setPendingChanges] = useState<Map<string, { date: Date; equipmentId: string | null; position: number }>>(new Map())
  const [saving, setSaving] = useState(false)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [selectedJobForNotes, setSelectedJobForNotes] = useState<ScheduledJob | null>(null)
  const [notesText, setNotesText] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [jobSearchNumber, setJobSearchNumber] = useState('')
  const [searchingJob, setSearchingJob] = useState(false)
  const [searchedJob, setSearchedJob] = useState<SchedulableJob | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)

  // Date range for scheduler view
  const [viewStartDate, setViewStartDate] = useState<Date>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })

  // Generate 7 days from start date
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(viewStartDate)
    date.setDate(date.getDate() + i)
    return date
  })

  useEffect(() => {
    loadDepartments()
  }, [])

  useEffect(() => {
    if (selectedDepartmentId) {
      loadEquipment()
      loadScheduledJobs()
      loadSchedulableJobs()
    }
  }, [selectedDepartmentId, viewStartDate])

  const saveAllChanges = useCallback(async () => {
    if (pendingChanges.size === 0) return

    try {
      setSaving(true)
      setError(null)

      // Process all changes
      for (const [scheduleId, change] of pendingChanges.entries()) {
        const res = await fetch('/api/schedules/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduleId: scheduleId,
            newPosition: change.position,
            newDate: change.date.toISOString(),
            newEquipmentId: change.equipmentId,
          }),
        })

        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || 'Failed to save changes')
        }
      }

      // Clear pending changes - state is already updated optimistically
      setPendingChanges(new Map())
    } catch (err: any) {
      setError(err.message)
      // On error, reload to get accurate server state
      await loadScheduledJobs()
    } finally {
      setSaving(false)
    }
  }, [pendingChanges])

  // Auto-save with debounce
  useEffect(() => {
    if (pendingChanges.size === 0) return

    const timeoutId = setTimeout(() => {
      saveAllChanges()
    }, 1000) // Auto-save after 1 second of inactivity

    return () => clearTimeout(timeoutId)
  }, [pendingChanges, saveAllChanges])

  const loadDepartments = async () => {
    try {
      const res = await fetch('/api/departments')
      if (!res.ok) throw new Error('Failed to load departments')

      const data = await res.json()
      setDepartments(data.data || [])

      // Auto-select first department
      if (data.data?.length > 0 && !selectedDepartmentId) {
        setSelectedDepartmentId(data.data[0].id)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadEquipment = async () => {
    if (!selectedDepartmentId) return

    try {
      const res = await fetch(`/api/equipment?departmentId=${selectedDepartmentId}`)
      if (!res.ok) throw new Error('Failed to load equipment')

      const data = await res.json()
      setEquipment(data.data || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const loadScheduledJobs = async () => {
    if (!selectedDepartmentId) return

    try {
      setLoading(true)
      setError(null)

      const endDate = new Date(viewStartDate)
      endDate.setDate(endDate.getDate() + 6)

      const params = new URLSearchParams({
        departmentId: selectedDepartmentId,
        startDate: viewStartDate.toISOString(),
        endDate: endDate.toISOString(),
      })

      const res = await fetch(`/api/schedules?${params}`)
      if (!res.ok) throw new Error('Failed to load scheduled jobs')

      const data = await res.json()
      setScheduledJobs(data.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadSchedulableJobs = async () => {
    if (!selectedDepartmentId) return

    try {
      const res = await fetch(`/api/pace/jobs/schedulable?departmentId=${selectedDepartmentId}`)
      if (!res.ok) throw new Error('Failed to load schedulable jobs')

      const data = await res.json()
      setSchedulableJobs(data.data.items || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const scheduleJob = async (job: SchedulableJob, date: Date) => {
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paceJobNumber: job.jobNumber,
          paceJobData: job.paceJobData,
          departmentId: selectedDepartmentId,
          equipmentId: selectedEquipment?.id || null,
          scheduledDate: date.toISOString(),
          priority: 'medium',
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to schedule job')
      }

      await loadScheduledJobs()
      await loadSchedulableJobs()
      setShowAddModal(false)
      setSelectedEquipment(null)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const removeScheduledJob = async (scheduleId: string) => {
    if (!confirm('Remove this job from the schedule?')) return

    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to remove scheduled job')
      }

      await loadScheduledJobs()
      await loadSchedulableJobs()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const handleDrop = (date: Date, equipmentId: string | null, insertPosition?: number) => {
    if (!draggedJob) return

    const jobsInTarget = getJobsForDateAndEquipment(date, equipmentId).filter(j => j.id !== draggedJob.id)

    // Determine new position
    let newPosition: number
    if (insertPosition !== undefined) {
      newPosition = insertPosition
    } else {
      // Drop at end of list
      newPosition = jobsInTarget.length + 1
    }

    // Track the change locally
    const newChanges = new Map(pendingChanges)
    newChanges.set(draggedJob.id, { date, equipmentId, position: newPosition })
    setPendingChanges(newChanges)

    // Update local state optimistically
    setScheduledJobs(prev => {
      // Remove the dragged job from everywhere first
      const withoutDraggedJob = prev.filter(job => job.id !== draggedJob.id)

      // Separate jobs into target and others
      const targetJobs = withoutDraggedJob.filter(job => {
        const jobDate = new Date(job.scheduledDate)
        const sameDate = (
          jobDate.getFullYear() === date.getFullYear() &&
          jobDate.getMonth() === date.getMonth() &&
          jobDate.getDate() === date.getDate()
        )
        const sameEquipment = job.equipmentId === equipmentId
        return sameDate && sameEquipment
      }).sort((a, b) => a.position - b.position)

      const otherJobs = withoutDraggedJob.filter(job => {
        const jobDate = new Date(job.scheduledDate)
        const sameDate = (
          jobDate.getFullYear() === date.getFullYear() &&
          jobDate.getMonth() === date.getMonth() &&
          jobDate.getDate() === date.getDate()
        )
        const sameEquipment = job.equipmentId === equipmentId
        return !(sameDate && sameEquipment)
      })

      // Insert dragged job at new position
      const updatedDraggedJob = {
        ...draggedJob,
        scheduledDate: date.toISOString(),
        equipmentId: equipmentId,
        position: newPosition,
      }

      targetJobs.splice(newPosition - 1, 0, updatedDraggedJob)

      // Renumber positions sequentially
      const reorderedJobs = targetJobs.map((job, idx) => ({
        ...job,
        position: idx + 1,
      }))

      return [...otherJobs, ...reorderedJobs]
    })

    setDraggedJob(null)
    setDragOverDate(null)
    setDragOverEquipmentId(null)
    setDragOverPosition(null)
  }

  const openPrintWindow = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=800')
    if (!printWindow) {
      alert('Please allow popups for this site to print the schedule')
      return
    }

    const departmentName = departments.find(d => d.id === selectedDepartmentId)?.name || 'Department'
    const dateRangeStart = dates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const dateRangeEnd = dates[dates.length - 1].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const printTime = `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

    const totalJobs = scheduledJobs.filter(job => {
      const jobDate = new Date(job.scheduledDate)
      return dates.some(date => jobDate.toISOString().split('T')[0] === date.toISOString().split('T')[0])
    }).length

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Job Schedule - ${departmentName}</title>
          <meta charset="utf-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: system-ui, -apple-system, sans-serif; font-size: 9pt; padding: 0.5cm; }
            .header { display: flex; justify-content: space-between; margin-bottom: 0.5cm; padding-bottom: 0.3cm; border-bottom: 2px solid #000; }
            h1 { font-size: 14pt; font-weight: bold; }
            h2 { font-size: 11pt; margin: 0.4cm 0 0.2cm 0; padding: 0.2cm 0.3cm; background: #f3f4f6; border-left: 4px solid #2563eb; font-weight: bold; }
            h3 { font-size: 9pt; margin: 0.3cm 0 0.2cm 0; font-weight: 600; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 0.3cm; font-size: 9pt; }
            th, td { border: 1px solid #333; padding: 0.15cm 0.2cm; }
            th { background: #f9fafb; font-weight: 600; text-align: left; }
            .equipment-badge { background: #e9d5ff; color: #7c3aed; padding: 0.1cm 0.25cm; border-radius: 0.15cm; font-size: 8pt; }
            .status-badge { background: #f3f4f6; padding: 0.05cm 0.2cm; border-radius: 0.1cm; font-size: 8pt; }
            .note { font-size: 7.5pt; color: #1e40af; font-style: italic; margin-top: 0.1cm; padding-left: 0.2cm; border-left: 2px solid #93c5fd; }
            .summary { margin-top: 0.5cm; padding-top: 0.3cm; border-top: 1px solid #666; }
            .print-btn { position: fixed; top: 15px; right: 15px; padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .print-btn:hover { background: #1d4ed8; }
            .print-btn:active { transform: scale(0.98); }
            @media print {
              .print-btn { display: none !important; }
              @page { size: A4 landscape; margin: 0.75cm; }
              body { padding: 0; }
              table { page-break-inside: avoid; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          <button class="print-btn" onclick="window.print()">🖨️ Print</button>

          <div class="header">
            <div>
              <h1>Job Schedule - ${departmentName}</h1>
              <div style="font-size: 9pt; color: #666; margin-top: 0.1cm;">
                ${dateRangeStart} - ${dateRangeEnd}
              </div>
            </div>
            <div style="font-size: 8pt; color: #999; text-align: right;">
              Printed: ${printTime}
            </div>
          </div>

          ${dates.map(date => {
            const dateKey = date.toISOString().split('T')[0]
            const dayJobs = scheduledJobs.filter(job => {
              const jobDate = new Date(job.scheduledDate)
              return jobDate.toISOString().split('T')[0] === dateKey
            })

            if (dayJobs.length === 0) return ''

            const dayString = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

            let html = `<h2>${dayString}</h2>`

            if (equipment.length > 0) {
              equipment.forEach(eq => {
                const equipmentJobs = dayJobs.filter(j => j.equipmentId === eq.id).sort((a, b) => a.position - b.position)
                if (equipmentJobs.length === 0) return

                html += `
                  <h3>
                    <span class="equipment-badge">${eq.name}</span>
                    <span style="color: #666; font-size: 8pt; margin-left: 0.2cm; font-weight: normal;">(${equipmentJobs.length} job${equipmentJobs.length !== 1 ? 's' : ''})</span>
                  </h3>
                  <table>
                    <thead>
                      <tr>
                        <th style="width: 3%">#</th>
                        <th style="width: 8%">Job #</th>
                        <th style="width: 22%">Customer</th>
                        <th style="width: 37%">Description</th>
                        <th style="width: 10%">Promise</th>
                        <th style="width: 12%">Status</th>
                        <th style="width: 8%">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${equipmentJobs.map((job, idx) => `
                        <tr>
                          <td style="text-align: center;">${idx + 1}</td>
                          <td><strong>${job.paceJobNumber}</strong></td>
                          <td>${job.paceJobData?.customerName || job.paceJobData?.custName || `Customer #${job.paceJobData?.customer}`}</td>
                          <td>
                            ${job.paceJobData?.description || '-'}
                            ${job.notes ? `<div class="note">Note: ${job.notes}</div>` : ''}
                          </td>
                          <td>${job.paceJobData?.promiseDateTime ? new Date(job.paceJobData.promiseDateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}</td>
                          <td><span class="status-badge">${job.status.replace('_', ' ')}</span></td>
                          <td style="text-align: center;">${job.estimatedHours ? job.estimatedHours + 'h' : '-'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                `
              })

              const unassignedJobs = dayJobs.filter(j => !j.equipmentId)
              if (unassignedJobs.length > 0) {
                html += `
                  <h3>
                    <span style="background: #f3f4f6; color: #374151; padding: 0.1cm 0.25cm; border-radius: 0.15cm; font-size: 8pt;">Unassigned</span>
                    <span style="color: #666; font-size: 8pt; margin-left: 0.2cm; font-weight: normal;">(${unassignedJobs.length} job${unassignedJobs.length !== 1 ? 's' : ''})</span>
                  </h3>
                  <table>
                    <thead>
                      <tr>
                        <th style="width: 3%">#</th>
                        <th style="width: 8%">Job #</th>
                        <th style="width: 22%">Customer</th>
                        <th style="width: 37%">Description</th>
                        <th style="width: 10%">Promise</th>
                        <th style="width: 12%">Status</th>
                        <th style="width: 8%">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${unassignedJobs.sort((a, b) => a.position - b.position).map((job, idx) => `
                        <tr>
                          <td style="text-align: center;">${idx + 1}</td>
                          <td><strong>${job.paceJobNumber}</strong></td>
                          <td>${job.paceJobData?.customerName || job.paceJobData?.custName || `Customer #${job.paceJobData?.customer}`}</td>
                          <td>
                            ${job.paceJobData?.description || '-'}
                            ${job.notes ? `<div class="note">Note: ${job.notes}</div>` : ''}
                          </td>
                          <td>${job.paceJobData?.promiseDateTime ? new Date(job.paceJobData.promiseDateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}</td>
                          <td><span class="status-badge">${job.status.replace('_', ' ')}</span></td>
                          <td style="text-align: center;">${job.estimatedHours ? job.estimatedHours + 'h' : '-'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                `
              }
            }

            return html
          }).join('')}

          <div class="summary">
            <strong>Total Jobs Scheduled:</strong> ${totalJobs}
          </div>
        </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  const handleDragOver = (e: React.DragEvent, date: Date, equipmentId: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    // Set effect allowed for better visual feedback
    e.dataTransfer.dropEffect = 'move'
    setDragOverDate(date)
    setDragOverEquipmentId(equipmentId)
  }

  const handleDragLeave = () => {
    setDragOverDate(null)
    setDragOverEquipmentId(null)
    setDragOverPosition(null)
  }

  const getJobsForDate = (date: Date) => {
    return scheduledJobs
      .filter(job => {
        const jobDate = new Date(job.scheduledDate)
        return (
          jobDate.getFullYear() === date.getFullYear() &&
          jobDate.getMonth() === date.getMonth() &&
          jobDate.getDate() === date.getDate()
        )
      })
      .sort((a, b) => a.position - b.position)
  }

  const getJobsForDateAndEquipment = (date: Date, equipmentId: string | null) => {
    return scheduledJobs
      .filter(job => {
        const jobDate = new Date(job.scheduledDate)
        const sameDate = (
          jobDate.getFullYear() === date.getFullYear() &&
          jobDate.getMonth() === date.getMonth() &&
          jobDate.getDate() === date.getDate()
        )
        const sameEquipment = job.equipmentId === equipmentId
        return sameDate && sameEquipment
      })
      .sort((a, b) => a.position - b.position)
  }

  // Get equipment list to show (filtered or all)
  const getVisibleEquipment = () => {
    if (selectedEquipmentId === 'all') {
      return equipment
    }
    return equipment.filter(eq => eq.id === selectedEquipmentId)
  }

  const formatDate = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.getTime() === today.getTime()) return 'Today'
    if (date.getTime() === tomorrow.getTime()) return 'Tomorrow'

    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700'
      case 'in_progress': return 'bg-yellow-100 text-yellow-700'
      case 'completed': return 'bg-green-100 text-green-700'
      case 'on_hold': return 'bg-gray-100 text-gray-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(viewStartDate)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    setViewStartDate(newDate)
  }

  const goToToday = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    setViewStartDate(today)
  }

  const openNotesModal = (job: ScheduledJob) => {
    setSelectedJobForNotes(job)
    setNotesText(job.notes || '')
    setShowNotesModal(true)
  }

  const saveNotes = async () => {
    if (!selectedJobForNotes) return

    try {
      setSavingNotes(true)
      setError(null)

      const res = await fetch(`/api/schedules/${selectedJobForNotes.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: notesText,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to save notes')
      }

      // Update local state
      setScheduledJobs(prev =>
        prev.map(job =>
          job.id === selectedJobForNotes.id
            ? { ...job, notes: notesText }
            : job
        )
      )

      setShowNotesModal(false)
      setSelectedJobForNotes(null)
      setNotesText('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingNotes(false)
    }
  }

  const moveJobUp = async (job: ScheduledJob) => {
    const jobsInSameLane = getJobsForDateAndEquipment(
      new Date(job.scheduledDate),
      job.equipmentId
    )
    const currentIndex = jobsInSameLane.findIndex(j => j.id === job.id)

    if (currentIndex <= 0) return // Already at top

    const newPosition = currentIndex // Move up means position - 1 in array (which is same as currentIndex in 1-based)

    // Track the change
    const newChanges = new Map(pendingChanges)
    newChanges.set(job.id, {
      date: new Date(job.scheduledDate),
      equipmentId: job.equipmentId,
      position: newPosition
    })
    setPendingChanges(newChanges)

    // Update local state optimistically
    setScheduledJobs(prev => {
      const updated = [...prev]
      const jobIndex = updated.findIndex(j => j.id === job.id)
      const swapIndex = updated.findIndex(j =>
        j.id === jobsInSameLane[currentIndex - 1].id
      )

      if (jobIndex !== -1 && swapIndex !== -1) {
        // Swap positions
        const tempPos = updated[jobIndex].position
        updated[jobIndex] = { ...updated[jobIndex], position: updated[swapIndex].position }
        updated[swapIndex] = { ...updated[swapIndex], position: tempPos }
      }

      return updated
    })
  }

  const moveJobDown = async (job: ScheduledJob) => {
    const jobsInSameLane = getJobsForDateAndEquipment(
      new Date(job.scheduledDate),
      job.equipmentId
    )
    const currentIndex = jobsInSameLane.findIndex(j => j.id === job.id)

    if (currentIndex >= jobsInSameLane.length - 1) return // Already at bottom

    const newPosition = currentIndex + 2 // Move down means position + 1 (and convert to 1-based)

    // Track the change
    const newChanges = new Map(pendingChanges)
    newChanges.set(job.id, {
      date: new Date(job.scheduledDate),
      equipmentId: job.equipmentId,
      position: newPosition
    })
    setPendingChanges(newChanges)

    // Update local state optimistically
    setScheduledJobs(prev => {
      const updated = [...prev]
      const jobIndex = updated.findIndex(j => j.id === job.id)
      const swapIndex = updated.findIndex(j =>
        j.id === jobsInSameLane[currentIndex + 1].id
      )

      if (jobIndex !== -1 && swapIndex !== -1) {
        // Swap positions
        const tempPos = updated[jobIndex].position
        updated[jobIndex] = { ...updated[jobIndex], position: updated[swapIndex].position }
        updated[swapIndex] = { ...updated[swapIndex], position: tempPos }
      }

      return updated
    })
  }

  const searchJobByNumber = async () => {
    if (!jobSearchNumber.trim()) {
      setSearchError('Please enter a job number')
      return
    }

    try {
      setSearchingJob(true)
      setSearchError(null)
      setSearchedJob(null)

      const res = await fetch(`/api/pace/jobs/${encodeURIComponent(jobSearchNumber.trim())}`)

      if (!res.ok) {
        if (res.status === 404) {
          setSearchError('Job not found in PACE system')
        } else {
          const errorData = await res.json()
          setSearchError(errorData.error || 'Failed to fetch job from PACE')
        }
        return
      }

      const jobData = await res.json()

      // Transform to SchedulableJob format
      const schedulableJob: SchedulableJob = {
        jobNumber: jobData.job || jobSearchNumber.trim(),
        customer: jobData.customer || '',
        customerName: jobData.customerName || jobData.custName || null,
        description: jobData.description || null,
        jobType: jobData.jobType || 0,
        jobTypeDescription: jobData.jobTypeDescription || null,
        promiseDateTime: jobData.promiseDateTime || null,
        isScheduled: false, // We'll check if it's already scheduled
        paceJobData: jobData,
      }

      setSearchedJob(schedulableJob)
    } catch (err: any) {
      setSearchError(err.message || 'Failed to search for job')
    } finally {
      setSearchingJob(false)
    }
  }

  const clearJobSearch = () => {
    setJobSearchNumber('')
    setSearchedJob(null)
    setSearchError(null)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Job Scheduler</h1>
        <p className="text-sm text-gray-600 mt-1">Schedule and manage jobs for your departments</p>
      </div>

      {/* Controls */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[250px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <select
            value={selectedDepartmentId}
            onChange={(e) => setSelectedDepartmentId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="">Select a department</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>

        {selectedDepartmentId && equipment.length > 0 && (
          <div className="flex-1 min-w-[250px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Equipment Filter</label>
            <select
              value={selectedEquipmentId}
              onChange={(e) => setSelectedEquipmentId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">All Equipment</option>
              {equipment.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => navigateWeek('prev')}
            className="px-3 py-2 text-sm bg-white hover:bg-gray-50 rounded-lg transition-colors font-medium text-gray-700 border border-gray-300"
          >
            ← Prev Week
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            Today
          </button>
          <button
            onClick={() => navigateWeek('next')}
            className="px-3 py-2 text-sm bg-white hover:bg-gray-50 rounded-lg transition-colors font-medium text-gray-700 border border-gray-300"
          >
            Next Week →
          </button>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          disabled={!selectedDepartmentId}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          + Add Job
        </button>

        <button
          onClick={openPrintWindow}
          disabled={!selectedDepartmentId}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Schedule
        </button>

        {saving && (
          <div className="flex gap-2 items-center pl-4 border-l border-gray-300">
            <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm text-blue-600 font-medium">
              Auto-saving...
            </span>
          </div>
        )}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}

      {!selectedDepartmentId ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <p className="text-lg font-medium text-gray-900 mb-1">No Department Selected</p>
            <p className="text-sm text-gray-600">Please select a department to view the scheduler</p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <p className="text-sm text-gray-600">Loading schedule...</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto px-6 py-4">
          {/* Equipment Swimlanes View */}
          <div className="flex gap-4 min-w-max pb-4">
            {dates.map((date, dateIdx) => {
              const visibleEquipment = getVisibleEquipment()
              const jobsForDate = getJobsForDate(date)
              const unassignedJobs = getJobsForDateAndEquipment(date, null)

              return (
                <div key={dateIdx} className="flex-shrink-0 w-[350px]">
                  <div className={`bg-white rounded-lg shadow transition-all ${
                    draggedJob && dragOverDate?.getTime() === date.getTime()
                      ? 'ring-2 ring-blue-500 shadow-lg'
                      : ''
                  }`}>
                    {/* Date Header */}
                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 sticky top-0 z-10 rounded-t-lg">
                      <h3 className="font-semibold text-base text-gray-900">{formatDate(date)}</h3>
                      <p className="text-xs text-gray-600 mt-0.5">{jobsForDate.length} jobs</p>
                    </div>

                    <div className="divide-y divide-gray-200">
                      {/* Unassigned Lane */}
                      {(unassignedJobs.length > 0 || (dragOverDate?.getTime() === date.getTime() && dragOverEquipmentId === null)) && (
                        <div className="p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                              Unassigned
                            </div>
                            <div className="text-xs text-gray-500">({unassignedJobs.length})</div>
                          </div>

                          <div
                            className={`min-h-[120px] space-y-3 rounded-lg transition-all ${
                              dragOverDate?.getTime() === date.getTime() && dragOverEquipmentId === null
                                ? 'bg-blue-100 border-2 border-blue-400 border-dashed p-4 shadow-inner'
                                : 'p-2'
                            }`}
                            onDragOver={(e) => {
                              handleDragOver(e, date, null)
                              const rect = e.currentTarget.getBoundingClientRect()
                              const y = e.clientY - rect.top
                              const cards = Array.from(e.currentTarget.children) as HTMLElement[]
                              let insertIdx = unassignedJobs.length
                              for (let i = 0; i < cards.length; i++) {
                                const cardRect = cards[i].getBoundingClientRect()
                                const cardY = cardRect.top - rect.top + cardRect.height / 2
                                if (y < cardY) {
                                  insertIdx = i
                                  break
                                }
                              }
                              setDragOverPosition(insertIdx)
                            }}
                            onDragLeave={handleDragLeave}
                            onDrop={() => handleDrop(date, null, dragOverPosition !== null ? dragOverPosition + 1 : undefined)}
                          >
                            {unassignedJobs.length === 0 ? (
                              <div className="text-center text-gray-400 text-xs py-6">
                                {dragOverDate?.getTime() === date.getTime() && dragOverEquipmentId === null
                                  ? '👇 Drop job here'
                                  : 'Drag jobs here'}
                              </div>
                            ) : (
                              <>
                                {unassignedJobs.map((job, idx) => {
                                  const isDragged = draggedJob?.id === job.id
                                  const showIndicatorBefore = draggedJob &&
                                    !isDragged &&
                                    dragOverDate?.getTime() === date.getTime() &&
                                    dragOverEquipmentId === null &&
                                    dragOverPosition === idx

                                  return (
                                  <div key={job.id} className="relative">
                                    {/* Show insertion indicator before this card */}
                                    {showIndicatorBefore && (
                                      <div className="h-2 flex items-center justify-center mb-1">
                                        <div className="h-1 w-full bg-blue-500 rounded-full shadow-md" />
                                      </div>
                                    )}
                                    <div
                                      className={`bg-white border rounded-xl p-4 transition-all ${
                                        isDragged
                                          ? 'opacity-30 border-gray-200 cursor-grabbing'
                                          : 'border-gray-200 hover:border-blue-400 hover:shadow-md cursor-grab'
                                      }`}
                                      draggable
                                      onDragStart={(e) => {
                                        setDraggedJob(job)
                                        e.dataTransfer.effectAllowed = 'move'
                                        e.dataTransfer.setData('text/plain', job.id)
                                      }}
                                      onDragEnd={() => {
                                        setDraggedJob(null)
                                        setDragOverDate(null)
                                        setDragOverEquipmentId(null)
                                        setDragOverPosition(null)
                                      }}
                                    >
                                      <div className="flex gap-3">
                                        {/* Action Buttons on the Left */}
                                        <div className="flex flex-col gap-1">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              moveJobUp(job)
                                            }}
                                            disabled={idx === 0}
                                            className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                                              idx === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600'
                                            }`}
                                            title="Move up"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                            </svg>
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              moveJobDown(job)
                                            }}
                                            disabled={idx === unassignedJobs.length - 1}
                                            className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                                              idx === unassignedJobs.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600'
                                            }`}
                                            title="Move down"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              openNotesModal(job)
                                            }}
                                            className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                                              job.notes ? 'text-blue-600' : 'text-gray-400'
                                            }`}
                                            title={job.notes ? 'View/edit notes' : 'Add notes'}
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              removeScheduledJob(job.id)
                                            }}
                                            className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                            title="Remove from schedule"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                              </svg>
                                            </button>
                                          </div>

                                        {/* Card Content on the Right */}
                                        <div className="flex-1 min-w-0">
                                          {/* Header with Job Number and Promise Date */}
                                          <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-sm text-gray-900">{job.paceJobNumber}</span>
                                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(job.status)}`}>
                                                {job.status.replace('_', ' ')}
                                              </span>
                                            </div>
                                            {job.paceJobData?.promiseDateTime && (
                                              <div className="text-xs text-gray-600">
                                                {new Date(job.paceJobData.promiseDateTime).toLocaleDateString()}
                                              </div>
                                            )}
                                          </div>

                                          {/* Customer Name */}
                                          <div className="mb-2">
                                            <div className="text-sm font-semibold text-gray-900 line-clamp-1">
                                              {(typeof job.paceJobData?.customerName === 'string' && job.paceJobData?.customerName)
                                                || (typeof job.paceJobData?.custName === 'string' && job.paceJobData?.custName)
                                                || (job.paceJobData?.customer ? `Customer #${job.paceJobData.customer}` : 'Unknown Customer')}
                                            </div>
                                          </div>

                                          {/* Description */}
                                          {typeof job.paceJobData?.description === 'string' && job.paceJobData.description && (
                                            <div className="text-xs text-gray-600 mb-3 line-clamp-2 leading-relaxed">
                                              {job.paceJobData.description}
                                            </div>
                                          )}

                                          {/* Estimated Hours */}
                                          {job.estimatedHours && (
                                            <div className="flex items-center gap-1 mb-3 text-xs text-gray-600">
                                              <span>⏱️</span>
                                              <span>{job.estimatedHours}h</span>
                                            </div>
                                          )}

                                          {/* Notes Indicator */}
                                          {job.notes && (
                                            <div className="mb-3 p-2 bg-blue-50 border-l-2 border-blue-400 rounded text-xs text-gray-700">
                                              <div className="flex items-start gap-1">
                                                <span className="text-blue-600">💬</span>
                                                <span className="line-clamp-2">{job.notes}</span>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  )
                                })}

                                {/* Show indicator at end */}
                                {draggedJob &&
                                 dragOverDate?.getTime() === date.getTime() &&
                                 dragOverEquipmentId === null &&
                                 dragOverPosition === unassignedJobs.length && (
                                  <div className="h-2 flex items-center justify-center mt-1">
                                    <div className="h-1 w-full bg-blue-500 rounded-full shadow-md" />
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Equipment Lanes */}
                      {visibleEquipment.map((eq) => {
                        const equipmentJobs = getJobsForDateAndEquipment(date, eq.id)

                        return (
                          <div key={eq.id} className="p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                                {eq.name}
                              </div>
                              <div className="text-xs text-gray-500">({equipmentJobs.length})</div>
                            </div>

                            <div
                              className={`min-h-[120px] space-y-3 rounded-lg transition-all ${
                                dragOverDate?.getTime() === date.getTime() && dragOverEquipmentId === eq.id
                                  ? 'bg-purple-100 border-2 border-purple-400 border-dashed p-4 shadow-inner'
                                  : 'p-2'
                              }`}
                              onDragOver={(e) => {
                                handleDragOver(e, date, eq.id)
                                const rect = e.currentTarget.getBoundingClientRect()
                                const y = e.clientY - rect.top
                                const cards = Array.from(e.currentTarget.children) as HTMLElement[]
                                let insertIdx = equipmentJobs.length
                                for (let i = 0; i < cards.length; i++) {
                                  const cardRect = cards[i].getBoundingClientRect()
                                  const cardY = cardRect.top - rect.top + cardRect.height / 2
                                  if (y < cardY) {
                                    insertIdx = i
                                    break
                                  }
                                }
                                setDragOverPosition(insertIdx)
                              }}
                              onDragLeave={handleDragLeave}
                              onDrop={() => handleDrop(date, eq.id, dragOverPosition !== null ? dragOverPosition + 1 : undefined)}
                            >
                              {equipmentJobs.length === 0 ? (
                                <div className="text-center text-gray-400 text-xs py-6">
                                  {dragOverDate?.getTime() === date.getTime() && dragOverEquipmentId === eq.id
                                    ? '👇 Drop job here'
                                    : 'Drag jobs here'}
                                </div>
                              ) : (
                                <>
                                  {equipmentJobs.map((job, idx) => {
                                    const isDragged = draggedJob?.id === job.id
                                    const showIndicatorBefore = draggedJob &&
                                      !isDragged &&
                                      dragOverDate?.getTime() === date.getTime() &&
                                      dragOverEquipmentId === eq.id &&
                                      dragOverPosition === idx

                                    return (
                                    <div key={job.id} className="relative">
                                      {/* Show insertion indicator before this card */}
                                      {showIndicatorBefore && (
                                        <div className="h-2 flex items-center justify-center mb-1">
                                          <div className="h-1 w-full bg-purple-500 rounded-full shadow-md" />
                                        </div>
                                      )}
                                      <div
                                        className={`bg-white border rounded-xl p-4 transition-all ${
                                          isDragged
                                            ? 'opacity-30 border-gray-200 cursor-grabbing'
                                            : 'border-gray-200 hover:border-blue-400 hover:shadow-md cursor-grab'
                                        }`}
                                        draggable
                                        onDragStart={(e) => {
                                          setDraggedJob(job)
                                          e.dataTransfer.effectAllowed = 'move'
                                          e.dataTransfer.setData('text/plain', job.id)
                                        }}
                                        onDragEnd={() => {
                                          setDraggedJob(null)
                                          setDragOverDate(null)
                                          setDragOverEquipmentId(null)
                                          setDragOverPosition(null)
                                        }}
                                      >
                                        <div className="flex gap-3">
                                          {/* Action Buttons on the Left */}
                                          <div className="flex flex-col gap-1">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                moveJobUp(job)
                                              }}
                                              disabled={idx === 0}
                                              className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                                                idx === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600'
                                              }`}
                                              title="Move up"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                              </svg>
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                moveJobDown(job)
                                              }}
                                              disabled={idx === equipmentJobs.length - 1}
                                              className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                                                idx === equipmentJobs.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600'
                                              }`}
                                              title="Move down"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                              </svg>
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                openNotesModal(job)
                                              }}
                                              className={`p-1 rounded hover:bg-gray-100 transition-colors ${
                                                job.notes ? 'text-blue-600' : 'text-gray-400'
                                              }`}
                                              title={job.notes ? 'View/edit notes' : 'Add notes'}
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                              </svg>
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                removeScheduledJob(job.id)
                                              }}
                                              className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                              title="Remove from schedule"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                              </svg>
                                            </button>
                                          </div>

                                          {/* Card Content on the Right */}
                                          <div className="flex-1 min-w-0">
                                            {/* Header with Job Number and Promise Date */}
                                            <div className="flex items-center justify-between mb-3">
                                              <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-gray-900">{job.paceJobNumber}</span>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusColor(job.status)}`}>
                                                  {job.status.replace('_', ' ')}
                                                </span>
                                              </div>
                                              {job.paceJobData?.promiseDateTime && (
                                                <div className="text-xs text-gray-600">
                                                  {new Date(job.paceJobData.promiseDateTime).toLocaleDateString()}
                                                </div>
                                              )}
                                            </div>

                                            {/* Customer Name */}
                                            <div className="mb-2">
                                              <div className="text-sm font-semibold text-gray-900 line-clamp-1">
                                                {(typeof job.paceJobData?.customerName === 'string' && job.paceJobData?.customerName)
                                                  || (typeof job.paceJobData?.custName === 'string' && job.paceJobData?.custName)
                                                  || (job.paceJobData?.customer ? `Customer #${job.paceJobData.customer}` : 'Unknown Customer')}
                                              </div>
                                            </div>

                                            {/* Description */}
                                            {typeof job.paceJobData?.description === 'string' && job.paceJobData.description && (
                                              <div className="text-xs text-gray-600 mb-3 line-clamp-2 leading-relaxed">
                                                {job.paceJobData.description}
                                              </div>
                                            )}

                                            {/* Estimated Hours & Assigned User */}
                                            <div className="flex items-center gap-3 mb-3 text-xs text-gray-600 flex-wrap">
                                              {job.estimatedHours && (
                                                <div className="flex items-center gap-1">
                                                  <span>⏱️</span>
                                                  <span>{job.estimatedHours}h</span>
                                                </div>
                                              )}
                                              {job.User && (
                                                <div className="flex items-center gap-1">
                                                  <span>👤</span>
                                                  <span>{job.User.name || job.User.email}</span>
                                                </div>
                                              )}
                                            </div>

                                            {/* Notes Indicator */}
                                            {job.notes && (
                                              <div className="mb-3 p-2 bg-blue-50 border-l-2 border-blue-400 rounded text-xs text-gray-700">
                                                <div className="flex items-start gap-1">
                                                  <span className="text-blue-600">💬</span>
                                                  <span className="line-clamp-2">{job.notes}</span>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    )
                                  })}

                                  {/* Show indicator at end */}
                                  {draggedJob &&
                                   dragOverDate?.getTime() === date.getTime() &&
                                   dragOverEquipmentId === eq.id &&
                                   dragOverPosition === equipmentJobs.length && (
                                    <div className="h-2 flex items-center justify-center mt-1">
                                      <div className="h-1 w-full bg-purple-500 rounded-full shadow-md" />
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add Job Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Add Job to Schedule</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Date
              </label>
              <input
                type="date"
                value={selectedDate.toISOString().split('T')[0]}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            {equipment.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Equipment (Optional)
                </label>
                <select
                  value={selectedEquipment?.id || ''}
                  onChange={(e) => {
                    const eq = equipment.find(x => x.id === e.target.value)
                    setSelectedEquipment(eq || null)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Unassigned</option>
                  {equipment.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Job Search Section */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Job by Number
              </h4>
              <p className="text-xs text-gray-600 mb-3">
                Can't find a job in the list below? Search by job number to fetch it from PACE
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={jobSearchNumber}
                  onChange={(e) => setJobSearchNumber(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchJobByNumber()}
                  placeholder="Enter job number..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <button
                  onClick={searchJobByNumber}
                  disabled={searchingJob || !jobSearchNumber.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {searchingJob ? 'Searching...' : 'Search'}
                </button>
                {(searchedJob || searchError) && (
                  <button
                    onClick={clearJobSearch}
                    className="px-3 py-2 text-sm bg-white hover:bg-gray-50 rounded-lg transition-colors font-medium text-gray-700 border border-gray-300"
                  >
                    Clear
                  </button>
                )}
              </div>

              {searchError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
                  {searchError}
                </div>
              )}

              {searchedJob && (
                <div className="mt-3">
                  <div
                    className="border border-green-300 bg-green-50 rounded-lg p-3 hover:bg-green-100 cursor-pointer transition-colors"
                    onClick={() => {
                      scheduleJob(searchedJob, selectedDate)
                      clearJobSearch()
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-semibold text-green-700">{searchedJob.jobNumber}</div>
                          <span className="text-xs px-2 py-0.5 bg-green-600 text-white rounded-full">
                            Found in PACE
                          </span>
                        </div>
                        <div className="text-sm text-gray-700">{searchedJob.customerName || 'Unknown'}</div>
                        {searchedJob.description && (
                          <div className="text-xs text-gray-600 mt-1">{searchedJob.description}</div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {searchedJob.jobTypeDescription}
                        </div>
                      </div>
                      <button className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium">
                        Add to Schedule
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-gray-700">Browse Available Jobs</h4>
              <div className="text-xs text-gray-600 mb-2">
                Jobs can be scheduled multiple times on different dates/machines
              </div>
              {schedulableJobs.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No jobs available
                </div>
              ) : (
                schedulableJobs
                  .map(job => (
                    <div
                      key={job.jobNumber}
                      className={`border rounded-lg p-3 hover:bg-gray-50 cursor-pointer ${
                        job.isScheduled ? 'border-orange-300 bg-orange-50' : 'border-gray-300'
                      }`}
                      onClick={() => scheduleJob(job, selectedDate)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-blue-700">{job.jobNumber}</div>
                            {job.isScheduled && (
                              <span className="text-xs px-2 py-0.5 bg-orange-200 text-orange-800 rounded-full">
                                Already scheduled
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-700">{job.customerName || 'Unknown'}</div>
                          {job.description && (
                            <div className="text-xs text-gray-600 mt-1">{job.description}</div>
                          )}
                          <div className="text-xs text-gray-500 mt-1">
                            {job.jobTypeDescription}
                          </div>
                        </div>
                        <button className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                          Add
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {showNotesModal && selectedJobForNotes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Job Notes</h3>
              <button
                onClick={() => {
                  setShowNotesModal(false)
                  setSelectedJobForNotes(null)
                  setNotesText('')
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-semibold text-blue-700 mb-1">
                {selectedJobForNotes.paceJobNumber}
              </div>
              <div className="text-sm text-gray-700">
                {(typeof selectedJobForNotes.paceJobData?.customerName === 'string' && selectedJobForNotes.paceJobData?.customerName)
                  || (typeof selectedJobForNotes.paceJobData?.custName === 'string' && selectedJobForNotes.paceJobData?.custName)
                  || 'Unknown Customer'}
              </div>
              {selectedJobForNotes.Equipment && (
                <div className="text-xs text-gray-600 mt-1">
                  📍 {selectedJobForNotes.Equipment.name}
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="Add notes for this scheduled job..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[150px]"
              />
              <div className="text-xs text-gray-500 mt-1">
                These notes are visible to all managers
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowNotesModal(false)
                  setSelectedJobForNotes(null)
                  setNotesText('')
                }}
                disabled={savingNotes}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
