'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Opportunity {
  id: string
  opportunityNumber: string
  title: string
  amount: string
  stage: string
  status: string
  expectedCloseDate: string | null
  createdAt: string
}

interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  company: string | null
  title: string | null
  status: string
  createdAt: string
  updatedAt: string
  opportunities: Opportunity[]
  _count: {
    opportunities: number
    quotes: number
  }
}

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  prospect: { label: 'Prospect', color: 'bg-blue-100 text-blue-800' },
  quoted: { label: 'Quoted', color: 'bg-purple-100 text-purple-800' },
  negotiation: { label: 'Negotiation', color: 'bg-yellow-100 text-yellow-800' },
  won: { label: 'Won', color: 'bg-green-100 text-green-800' },
  lost: { label: 'Lost', color: 'bg-red-100 text-red-800' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-green-100 text-green-800' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800' },
}

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [contact, setContact] = useState<Contact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    title: '',
  })

  useEffect(() => {
    async function fetchContact() {
      try {
        const response = await fetch(`/api/crm/contacts/${id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch contact')
        }
        const data = await response.json()
        setContact(data.data)
        setFormData({
          firstName: data.data.firstName,
          lastName: data.data.lastName,
          email: data.data.email,
          phone: data.data.phone || '',
          company: data.data.company || '',
          title: data.data.title || '',
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchContact()
  }, [id])

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/crm/contacts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update contact')
      }

      const data = await response.json()
      setContact(data.data)
      setEditDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteContact = async () => {
    if (!confirm('Are you sure you want to delete this contact? This action cannot be undone.')) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/crm/contacts/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete contact')
      }

      router.push('/crm/contacts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setSubmitting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(amount))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-teal-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  if (error || !contact) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error || 'Contact not found'}</p>
        <Link href="/crm/contacts">
          <Button variant="outline" className="mt-4">
            Back to Contacts
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/crm/contacts">
            <Button variant="ghost" size="sm" className="mb-2">
              ← Back to Contacts
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">
            {contact.firstName} {contact.lastName}
          </h1>
          {contact.title && <p className="text-gray-600">{contact.title}</p>}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setEditDialogOpen(true)}
          >
            Edit Contact
          </Button>
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Contact</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateContact} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      required
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      required
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-700">
                    {submitting ? 'Updating...' : 'Update Contact'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="destructive" onClick={deleteContact} disabled={submitting || contact._count.opportunities > 0}>
            Delete
          </Button>
        </div>
      </div>

      {/* Contact Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Email</div>
          <a href={`mailto:${contact.email}`} className="text-teal-600 hover:underline">
            {contact.email}
          </a>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Phone</div>
          {contact.phone ? (
            <a href={`tel:${contact.phone}`} className="text-teal-600 hover:underline">
              {contact.phone}
            </a>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Company</div>
          <div>{contact.company || '-'}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Opportunities</div>
          <div className="text-3xl font-bold text-teal-600">{contact._count.opportunities}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Quotes</div>
          <div className="text-3xl font-bold text-teal-600">{contact._count.quotes}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-1">Status</div>
          <Badge className={contact.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
            {contact.status}
          </Badge>
        </div>
      </div>

      {/* Opportunities Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Opportunities</h2>
          <Link href={`/crm/opportunities/new?contactId=${contact.id}`}>
            <Button className="bg-teal-600 hover:bg-teal-700">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Opportunity
            </Button>
          </Link>
        </div>

        {contact.opportunities.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mb-2">No opportunities yet</p>
            <p className="text-sm">Create your first opportunity for this contact.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expected Close</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contact.opportunities.map((opp) => {
                const stageConfig = STAGE_CONFIG[opp.stage] || { label: opp.stage, color: 'bg-gray-100' }
                const statusConfig = STATUS_CONFIG[opp.status] || { label: opp.status, color: 'bg-gray-100' }
                return (
                  <TableRow key={opp.id}>
                    <TableCell>
                      <Link
                        href={`/crm/opportunities/${opp.id}`}
                        className="font-mono font-medium text-teal-600 hover:underline"
                      >
                        {opp.opportunityNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{opp.title}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(opp.amount)}</TableCell>
                    <TableCell>
                      <Badge className={stageConfig.color}>
                        {stageConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig.color}>
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {opp.expectedCloseDate ? formatDate(opp.expectedCloseDate) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/crm/opportunities/${opp.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {contact._count.opportunities > 0 && (
        <div className="mt-6 text-sm text-gray-600">
          Note: Cannot delete contact with opportunities. Delete or reassign opportunities first.
        </div>
      )}
    </div>
  )
}
