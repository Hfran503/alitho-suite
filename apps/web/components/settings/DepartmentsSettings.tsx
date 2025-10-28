'use client'

import { useState, useEffect } from 'react'

interface JobType {
  id: number
  description: string
  active: boolean
}

interface DepartmentJobType {
  id: string
  paceJobTypeId: number
  jobTypeName: string
}

interface Equipment {
  id: string
  name: string
  description: string | null
  isActive: boolean
}

interface Department {
  id: string
  name: string
  description: string | null
  color: string | null
  isActive: boolean
  jobTypes: DepartmentJobType[]
  equipment?: Equipment[]
}

export function DepartmentsSettings() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [availableJobTypes, setAvailableJobTypes] = useState<JobType[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingJobTypes, setLoadingJobTypes] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Equipment management state
  const [showEquipmentModal, setShowEquipmentModal] = useState(false)
  const [selectedDepartmentForEquipment, setSelectedDepartmentForEquipment] = useState<Department | null>(null)
  const [equipmentForm, setEquipmentForm] = useState({
    name: '',
    description: '',
  })

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    selectedJobTypes: [] as number[],
  })

  useEffect(() => {
    loadDepartments()
  }, [])

  const loadDepartments = async () => {
    try {
      setLoading(true)
      setError('')

      const res = await fetch('/api/departments')
      if (!res.ok) throw new Error('Failed to load departments')

      const data = await res.json()
      setDepartments(data.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadJobTypes = async () => {
    try {
      setLoadingJobTypes(true)
      setError('')

      const res = await fetch('/api/pace/job-types')
      if (!res.ok) throw new Error('Failed to load job types from PACE')

      const data = await res.json()
      setAvailableJobTypes(data.data.items || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoadingJobTypes(false)
    }
  }

  const handleAdd = () => {
    setFormData({
      name: '',
      description: '',
      color: '#3B82F6',
      selectedJobTypes: [],
    })
    setEditingDepartment(null)
    setShowAddForm(true)
    if (availableJobTypes.length === 0) {
      loadJobTypes()
    }
  }

  const handleEdit = (department: Department) => {
    setFormData({
      name: department.name,
      description: department.description || '',
      color: department.color || '#3B82F6',
      selectedJobTypes: department.jobTypes.map(jt => jt.paceJobTypeId),
    })
    setEditingDepartment(department)
    setShowAddForm(true)
    if (availableJobTypes.length === 0) {
      loadJobTypes()
    }
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingDepartment(null)
    setFormData({
      name: '',
      description: '',
      color: '#3B82F6',
      selectedJobTypes: [],
    })
    setError('')
  }

  const handleSubmit = async () => {
    if (!formData.name) {
      setError('Department name is required')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const jobTypes = formData.selectedJobTypes.map(id => {
        const jt = availableJobTypes.find(j => j.id === id)
        return {
          paceJobTypeId: id,
          jobTypeName: jt?.description || `Job Type ${id}`,
        }
      })

      const payload = {
        name: formData.name,
        description: formData.description || null,
        color: formData.color,
        jobTypes,
      }

      let res
      if (editingDepartment) {
        res = await fetch(`/api/departments/${editingDepartment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to save department')
      }

      setSuccess(editingDepartment ? 'Department updated successfully!' : 'Department created successfully!')
      await loadDepartments()
      handleCancel()

      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (department: Department) => {
    if (!confirm(`Are you sure you want to delete "${department.name}"? This will also remove all job type assignments.`)) {
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const res = await fetch(`/api/departments/${department.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to delete department')
      }

      setSuccess('Department deleted successfully!')
      await loadDepartments()

      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleJobType = (jobTypeId: number) => {
    setFormData(prev => ({
      ...prev,
      selectedJobTypes: prev.selectedJobTypes.includes(jobTypeId)
        ? prev.selectedJobTypes.filter(id => id !== jobTypeId)
        : [...prev.selectedJobTypes, jobTypeId],
    }))
  }

  // Equipment management functions
  const openEquipmentModal = (department: Department) => {
    setSelectedDepartmentForEquipment(department)
    setEquipmentForm({ name: '', description: '' })
    setShowEquipmentModal(true)
  }

  const closeEquipmentModal = () => {
    setShowEquipmentModal(false)
    setSelectedDepartmentForEquipment(null)
    setEquipmentForm({ name: '', description: '' })
  }

  const handleAddEquipment = async () => {
    if (!selectedDepartmentForEquipment || !equipmentForm.name) {
      setError('Equipment name is required')
      return
    }

    try {
      setSaving(true)
      setError('')

      const res = await fetch('/api/equipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: equipmentForm.name,
          description: equipmentForm.description || null,
          departmentId: selectedDepartmentForEquipment.id,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to add equipment')
      }

      setSuccess('Equipment added successfully!')
      await loadDepartments()
      closeEquipmentModal()

      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteEquipment = async (equipmentId: string, equipmentName: string) => {
    if (!confirm(`Are you sure you want to delete "${equipmentName}"?`)) {
      return
    }

    try {
      setSaving(true)
      setError('')

      const res = await fetch(`/api/equipment/${equipmentId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to delete equipment')
      }

      setSuccess('Equipment deleted successfully!')
      await loadDepartments()

      setTimeout(() => setSuccess(''), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading departments...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Departments</h3>
          <p className="text-sm text-gray-600">
            Manage departments and link them to job types
          </p>
        </div>
        <button
          onClick={handleAdd}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          Add Department
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-600">{success}</p>
        </div>
      )}

      {showAddForm && (
        <div className="border border-gray-300 rounded-lg p-6 bg-gray-50">
          <h4 className="font-semibold mb-4">
            {editingDepartment ? 'Edit Department' : 'Add New Department'}
          </h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Design, Production, Finishing"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Optional description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color
              </label>
              <input
                type="color"
                value={formData.color}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Types
              </label>
              {loadingJobTypes ? (
                <div className="text-sm text-gray-500">Loading job types from PACE...</div>
              ) : availableJobTypes.length === 0 ? (
                <div className="text-sm text-gray-500">
                  No job types available. Make sure PACE API is configured.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-lg p-3 bg-white">
                  {availableJobTypes.filter(jt => jt.active).map((jobType) => (
                    <label
                      key={jobType.id}
                      className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.selectedJobTypes.includes(jobType.id)}
                        onChange={() => toggleJobType(jobType.id)}
                        className="mr-3 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm">
                        {jobType.description} (ID: {jobType.id})
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Select which job types belong to this department
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                onClick={handleSubmit}
                disabled={saving || loadingJobTypes}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingDepartment ? 'Update' : 'Create'}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {departments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No departments configured. Click "Add Department" to create one.
          </div>
        ) : (
          departments.map((department) => (
            <div
              key={department.id}
              className="border border-gray-300 rounded-lg p-4 bg-white"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {department.color && (
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: department.color }}
                      />
                    )}
                    <h4 className="font-semibold text-lg">{department.name}</h4>
                  </div>

                  {department.description && (
                    <p className="text-sm text-gray-600 mb-3">{department.description}</p>
                  )}

                  <div className="mt-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Job Types ({department.jobTypes.length}):
                    </p>
                    {department.jobTypes.length === 0 ? (
                      <p className="text-sm text-gray-500">No job types assigned</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {department.jobTypes.map((jt) => (
                          <span
                            key={jt.id}
                            className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                          >
                            {jt.jobTypeName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Equipment Section */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-700">
                        Equipment/Machines ({department.equipment?.length || 0}):
                      </p>
                      <button
                        onClick={() => openEquipmentModal(department)}
                        disabled={saving}
                        className="px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 text-xs"
                      >
                        + Add Equipment
                      </button>
                    </div>
                    {!department.equipment || department.equipment.length === 0 ? (
                      <p className="text-sm text-gray-500">No equipment added</p>
                    ) : (
                      <div className="space-y-1">
                        {department.equipment.map((eq) => (
                          <div
                            key={eq.id}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                          >
                            <div className="flex-1">
                              <span className="font-medium">{eq.name}</span>
                              {eq.description && (
                                <span className="text-gray-600 ml-2">- {eq.description}</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleDeleteEquipment(eq.id, eq.name)}
                              disabled={saving}
                              className="text-red-600 hover:text-red-800 text-xs px-2"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => handleEdit(department)}
                    disabled={saving}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(department)}
                    disabled={saving}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Equipment Modal */}
      {showEquipmentModal && selectedDepartmentForEquipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">
                Add Equipment to {selectedDepartmentForEquipment.name}
              </h3>
              <button
                onClick={closeEquipmentModal}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Equipment Name *
                </label>
                <input
                  type="text"
                  value={equipmentForm.name}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Press 1, Cutter A, Folder 3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={equipmentForm.description}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Additional details about this equipment"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleAddEquipment}
                  disabled={saving || !equipmentForm.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Adding...' : 'Add Equipment'}
                </button>
                <button
                  onClick={closeEquipmentModal}
                  disabled={saving}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
