'use client'

import { useState, useEffect } from 'react'

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

  const saveAllChanges = async () => {
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

      // Clear pending changes
      setPendingChanges(new Map())

      // Reload to get accurate server state
      await loadScheduledJobs()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const discardChanges = () => {
    setPendingChanges(new Map())
    loadScheduledJobs()
  }

  const handleDragOver = (e: React.DragEvent, date: Date, equipmentId: string | null) => {
    e.preventDefault()
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

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴'
      case 'medium': return '🟡'
      case 'low': return '🟢'
      default: return '⚪'
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

  return (
    <div className="h-screen flex flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Job Scheduler</h1>
        <p className="text-gray-600">Schedule and manage jobs for your departments</p>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[250px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <select
            value={selectedDepartmentId}
            onChange={(e) => setSelectedDepartmentId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            ← Prev Week
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Today
          </button>
          <button
            onClick={() => navigateWeek('next')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Next Week →
          </button>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          disabled={!selectedDepartmentId}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add Job
        </button>

        {pendingChanges.size > 0 && (
          <div className="flex gap-2 items-center">
            <span className="text-sm text-orange-600 font-medium">
              {pendingChanges.size} unsaved change{pendingChanges.size !== 1 ? 's' : ''}
            </span>
            <button
              onClick={saveAllChanges}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={discardChanges}
              disabled={saving}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
            >
              Discard
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {!selectedDepartmentId ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Please select a department to view the scheduler
        </div>
      ) : loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          Loading schedule...
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {/* Equipment Swimlanes View */}
          <div className="flex gap-4 min-w-max pb-4">
            {dates.map((date, dateIdx) => {
              const visibleEquipment = getVisibleEquipment()
              const jobsForDate = getJobsForDate(date)
              const unassignedJobs = getJobsForDateAndEquipment(date, null)

              return (
                <div key={dateIdx} className="flex-shrink-0 w-[350px]">
                  <div className="bg-white rounded-lg border border-gray-300">
                    {/* Date Header */}
                    <div className="p-4 border-b border-gray-200 bg-gray-50 sticky top-0 z-10">
                      <h3 className="font-semibold text-lg">{formatDate(date)}</h3>
                      <p className="text-sm text-gray-600">{jobsForDate.length} jobs</p>
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
                            className={`min-h-[80px] space-y-2 ${
                              dragOverDate?.getTime() === date.getTime() && dragOverEquipmentId === null
                                ? 'bg-blue-50 rounded-lg p-2'
                                : ''
                            }`}
                            onDragOver={(e) => {
                              handleDragOver(e, date, null)
                              if (e.target === e.currentTarget) {
                                setDragOverPosition(unassignedJobs.length)
                              }
                            }}
                            onDragLeave={handleDragLeave}
                            onDrop={() => handleDrop(date, null)}
                          >
                            {unassignedJobs.length === 0 ? (
                              <div className="text-center text-gray-400 text-xs py-6">
                                {dragOverDate?.getTime() === date.getTime() && dragOverEquipmentId === null
                                  ? 'Drop job here'
                                  : 'No jobs'}
                              </div>
                            ) : (
                              <>
                                {unassignedJobs.map((job, idx) => (
                                  <div key={job.id}>
                                    {draggedJob &&
                                     draggedJob.id !== job.id &&
                                     dragOverDate?.getTime() === date.getTime() &&
                                     dragOverEquipmentId === null &&
                                     dragOverPosition === idx && (
                                      <div className="h-1 bg-blue-500 rounded-full mb-1 animate-pulse" />
                                    )}

                                    <div
                                      className={`bg-white border-2 rounded-lg p-2 hover:shadow-md transition-shadow cursor-move text-xs ${
                                        draggedJob?.id === job.id
                                          ? 'opacity-50 border-blue-400'
                                          : 'border-gray-300'
                                      }`}
                                      draggable
                                      onDragStart={() => setDraggedJob(job)}
                                      onDragEnd={() => {
                                        setDraggedJob(null)
                                        setDragOverDate(null)
                                        setDragOverEquipmentId(null)
                                        setDragOverPosition(null)
                                      }}
                                      onDragOver={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        setDragOverDate(date)
                                        setDragOverEquipmentId(null)
                                        setDragOverPosition(idx)
                                      }}
                                      onDrop={(e) => {
                                        e.stopPropagation()
                                        handleDrop(date, null, job.position)
                                      }}
                                    >
                                      <div className="flex items-start justify-between mb-1">
                                        <div className="flex items-center gap-1">
                                          <span className="text-[10px]">{getPriorityIcon(job.priority)}</span>
                                          <span className="font-semibold text-blue-700">{job.paceJobNumber}</span>
                                        </div>
                                        <button
                                          onClick={() => removeScheduledJob(job.id)}
                                          className="text-red-500 hover:text-red-700"
                                        >
                                          ×
                                        </button>
                                      </div>

                                      <div className="text-gray-700 mb-1 font-medium line-clamp-1">
                                        {(typeof job.paceJobData?.customerName === 'string' && job.paceJobData?.customerName)
                                          || (typeof job.paceJobData?.custName === 'string' && job.paceJobData?.custName)
                                          || (job.paceJobData?.customer ? `ID: ${job.paceJobData.customer}` : 'Unknown Customer')}
                                      </div>

                                      {typeof job.paceJobData?.description === 'string' && job.paceJobData.description && (
                                        <div className="text-[10px] text-gray-600 mb-1 line-clamp-2">
                                          {job.paceJobData.description}
                                        </div>
                                      )}

                                      <div className="flex items-center justify-between">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getStatusColor(job.status)}`}>
                                          {job.status.replace('_', ' ')}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}

                                {draggedJob &&
                                 dragOverDate?.getTime() === date.getTime() &&
                                 dragOverEquipmentId === null &&
                                 dragOverPosition === unassignedJobs.length && (
                                  <div className="h-1 bg-blue-500 rounded-full animate-pulse" />
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
                              className={`min-h-[80px] space-y-2 ${
                                dragOverDate?.getTime() === date.getTime() && dragOverEquipmentId === eq.id
                                  ? 'bg-purple-50 rounded-lg p-2'
                                  : ''
                              }`}
                              onDragOver={(e) => {
                                handleDragOver(e, date, eq.id)
                                if (e.target === e.currentTarget) {
                                  setDragOverPosition(equipmentJobs.length)
                                }
                              }}
                              onDragLeave={handleDragLeave}
                              onDrop={() => handleDrop(date, eq.id)}
                            >
                              {equipmentJobs.length === 0 ? (
                                <div className="text-center text-gray-400 text-xs py-6">
                                  {dragOverDate?.getTime() === date.getTime() && dragOverEquipmentId === eq.id
                                    ? 'Drop job here'
                                    : 'No jobs'}
                                </div>
                              ) : (
                                <>
                                  {equipmentJobs.map((job, idx) => (
                                    <div key={job.id}>
                                      {draggedJob &&
                                       draggedJob.id !== job.id &&
                                       dragOverDate?.getTime() === date.getTime() &&
                                       dragOverEquipmentId === eq.id &&
                                       dragOverPosition === idx && (
                                        <div className="h-1 bg-blue-500 rounded-full mb-1 animate-pulse" />
                                      )}

                                      <div
                                        className={`bg-white border-2 rounded-lg p-2 hover:shadow-md transition-shadow cursor-move text-xs ${
                                          draggedJob?.id === job.id
                                            ? 'opacity-50 border-blue-400'
                                            : 'border-gray-300'
                                        }`}
                                        draggable
                                        onDragStart={() => setDraggedJob(job)}
                                        onDragEnd={() => {
                                          setDraggedJob(null)
                                          setDragOverDate(null)
                                          setDragOverEquipmentId(null)
                                          setDragOverPosition(null)
                                        }}
                                        onDragOver={(e) => {
                                          e.preventDefault()
                                          e.stopPropagation()
                                          setDragOverDate(date)
                                          setDragOverEquipmentId(eq.id)
                                          setDragOverPosition(idx)
                                        }}
                                        onDrop={(e) => {
                                          e.stopPropagation()
                                          handleDrop(date, eq.id, job.position)
                                        }}
                                      >
                                        <div className="flex items-start justify-between mb-1">
                                          <div className="flex items-center gap-1">
                                            <span className="text-[10px]">{getPriorityIcon(job.priority)}</span>
                                            <span className="font-semibold text-blue-700">{job.paceJobNumber}</span>
                                          </div>
                                          <button
                                            onClick={() => removeScheduledJob(job.id)}
                                            className="text-red-500 hover:text-red-700"
                                          >
                                            ×
                                          </button>
                                        </div>

                                        <div className="text-gray-700 mb-1 font-medium line-clamp-1">
                                          {(typeof job.paceJobData?.customerName === 'string' && job.paceJobData?.customerName)
                                            || (typeof job.paceJobData?.custName === 'string' && job.paceJobData?.custName)
                                            || (job.paceJobData?.customer ? `ID: ${job.paceJobData.customer}` : 'Unknown Customer')}
                                        </div>

                                        {typeof job.paceJobData?.description === 'string' && job.paceJobData.description && (
                                          <div className="text-[10px] text-gray-600 mb-1 line-clamp-2">
                                            {job.paceJobData.description}
                                          </div>
                                        )}

                                        <div className="flex items-center justify-between">
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getStatusColor(job.status)}`}>
                                            {job.status.replace('_', ' ')}
                                          </span>
                                        </div>

                                        {job.User && (
                                          <div className="mt-1 text-[10px] text-gray-600">
                                            👤 {job.User.name || job.User.email}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}

                                  {draggedJob &&
                                   dragOverDate?.getTime() === date.getTime() &&
                                   dragOverEquipmentId === eq.id &&
                                   dragOverPosition === equipmentJobs.length && (
                                    <div className="h-1 bg-blue-500 rounded-full animate-pulse" />
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Unassigned</option>
                  {equipment.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="font-semibold text-gray-700">Available Jobs</h4>
              {schedulableJobs.filter(j => !j.isScheduled).length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  All jobs are already scheduled or no jobs available
                </div>
              ) : (
                schedulableJobs
                  .filter(j => !j.isScheduled)
                  .map(job => (
                    <div
                      key={job.jobNumber}
                      className="border border-gray-300 rounded-lg p-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => scheduleJob(job, selectedDate)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-blue-700">{job.jobNumber}</div>
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
    </div>
  )
}
