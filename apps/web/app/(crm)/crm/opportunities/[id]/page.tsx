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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Quote {
  id: string
  quoteNumber: string
  version: number
  title: string | null
  total: string
  status: string
  validUntil: string | null
  createdAt: string
}

interface AttachmentData {
  filename: string
  originalName: string
  url: string
  size: number
}

interface Opportunity {
  id: string
  opportunityNumber: string
  title: string
  description: string | null
  amount: string
  stage: string
  status: string
  expectedCloseDate: string | null
  notes: string | null
  closedAt: string | null
  createdAt: string
  updatedAt: string
  metadata?: {
    attachments?: AttachmentData[]
  } | null
  contact: {
    id: string
    firstName: string
    lastName: string
    email: string
    company: string | null
  }
  quotes: Quote[]
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

const QUOTE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-800' },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  expired: { label: 'Expired', color: 'bg-orange-100 text-orange-800' },
}

// Parse quote request description into structured items
interface ParsedProduct {
  name: string
  type?: string
  quantities?: string
  fields: { label: string; value: string }[]
}

interface ParsedDescription {
  requestType: string | null
  products: ParsedProduct[]
  additionalNotes: string | null
}

function parseQuoteDescription(description: string): ParsedDescription | null {
  if (!description) return null

  // Check if this is a quote request format
  const requestTypeMatch = description.match(/^(STANDARD|RUSH) PRODUCTS REQUEST:/)
  if (!requestTypeMatch) return null

  const requestType = requestTypeMatch[1]
  const products: ParsedProduct[] = []
  let additionalNotes: string | null = null

  // Extract additional notes first
  const notesMatch = description.match(/Additional Notes:\s*(.+)$/)
  if (notesMatch) {
    additionalNotes = notesMatch[1].trim()
  }

  // Split by "Product N:" pattern
  const productParts = description.split(/Product \d+:/).slice(1)

  for (const part of productParts) {
    const cleanPart = part.replace(/Additional Notes:.*$/, '').trim()
    if (!cleanPart) continue

    const product: ParsedProduct = {
      name: '',
      fields: [],
    }

    // Parse fields with "- Field: Value" pattern
    const fieldMatches = cleanPart.matchAll(/- ([^:]+):\s*([^-]+?)(?=\s*-|$)/g)
    for (const match of fieldMatches) {
      const label = match[1].trim()
      const value = match[2].trim()

      if (label === 'Type') {
        product.type = value
        product.name = value
      } else if (label === 'Quantities') {
        product.quantities = value
      } else if (value) {
        product.fields.push({ label, value })
      }
    }

    if (product.name || product.fields.length > 0) {
      products.push(product)
    }
  }

  return products.length > 0 ? { requestType, products, additionalNotes } : null
}

export default function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    stage: 'prospect',
    status: 'open',
    expectedCloseDate: '',
    notes: '',
  })

  useEffect(() => {
    async function fetchOpportunity() {
      try {
        const response = await fetch(`/api/crm/opportunities/${id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch opportunity')
        }
        const data = await response.json()
        setOpportunity(data.data)
        setFormData({
          title: data.data.title,
          description: data.data.description || '',
          amount: data.data.amount,
          stage: data.data.stage,
          status: data.data.status,
          expectedCloseDate: data.data.expectedCloseDate
            ? new Date(data.data.expectedCloseDate).toISOString().split('T')[0]
            : '',
          notes: data.data.notes || '',
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchOpportunity()
  }, [id])

  const handleUpdateOpportunity = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/crm/opportunities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: Number(formData.amount),
          expectedCloseDate: formData.expectedCloseDate || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update opportunity')
      }

      const data = await response.json()
      setOpportunity(data.data)
      setEditDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteOpportunity = async () => {
    if (!confirm('Are you sure you want to delete this opportunity? This action cannot be undone.')) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/crm/opportunities/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete opportunity')
      }

      router.push('/crm/opportunities')
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

  if (error || !opportunity) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error || 'Opportunity not found'}</p>
        <Link href="/crm/opportunities">
          <Button variant="outline" className="mt-4">
            Back to Opportunities
          </Button>
        </Link>
      </div>
    )
  }

  const stageConfig = STAGE_CONFIG[opportunity.stage] || { label: opportunity.stage, color: 'bg-gray-100' }
  const statusConfig = STATUS_CONFIG[opportunity.status] || { label: opportunity.status, color: 'bg-gray-100' }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/crm/opportunities">
            <Button variant="ghost" size="sm" className="mb-2">
              ← Back to Opportunities
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{opportunity.title}</h1>
            <Badge className={stageConfig.color}>{stageConfig.label}</Badge>
            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
          </div>
          <p className="text-gray-600 font-mono mt-1">{opportunity.opportunityNumber}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setEditDialogOpen(true)}
          >
            Edit Opportunity
          </Button>
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Opportunity</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateOpportunity} className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="stage">Stage</Label>
                    <Select value={formData.stage} onValueChange={(v) => setFormData({ ...formData, stage: v })}>
                      <SelectTrigger id="stage">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STAGE_CONFIG).map(([value, config]) => (
                          <SelectItem key={value} value={value}>
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                          <SelectItem key={value} value={value}>
                            {config.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
                  <Input
                    id="expectedCloseDate"
                    type="date"
                    value={formData.expectedCloseDate}
                    onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-700">
                    {submitting ? 'Updating...' : 'Update Opportunity'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="destructive" onClick={deleteOpportunity} disabled={submitting}>
            Delete
          </Button>
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">Contact</div>
            <Link
              href={`/crm/contacts/${opportunity.contact.id}`}
              className="text-teal-600 hover:underline font-medium"
            >
              {opportunity.contact.firstName} {opportunity.contact.lastName}
            </Link>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Email</div>
            <a href={`mailto:${opportunity.contact.email}`} className="text-teal-600 hover:underline">
              {opportunity.contact.email}
            </a>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Company</div>
            <div>{opportunity.contact.company || '-'}</div>
          </div>
        </div>
      </div>

      {/* Opportunity Details */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Opportunity Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-gray-600 mb-1">Amount</div>
            <div className="text-2xl font-bold text-teal-600">{formatCurrency(opportunity.amount)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Expected Close Date</div>
            <div className="text-lg">{opportunity.expectedCloseDate ? formatDate(opportunity.expectedCloseDate) : '-'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Created</div>
            <div className="text-lg">{formatDate(opportunity.createdAt)}</div>
          </div>
        </div>
        {opportunity.description && (() => {
          const parsed = parseQuoteDescription(opportunity.description)
          if (parsed) {
            return (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="text-sm text-gray-600">Request Type</div>
                  <Badge className={parsed.requestType === 'RUSH' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}>
                    {parsed.requestType}
                  </Badge>
                </div>

                <div className="text-sm text-gray-600 mb-3">Requested Items ({parsed.products.length})</div>
                <div className="space-y-3">
                  {parsed.products.map((product, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className="text-xs font-medium text-gray-500 uppercase">Product {index + 1}</span>
                          <h4 className="text-lg font-semibold text-gray-900">{product.name || 'Custom Product'}</h4>
                        </div>
                        {product.quantities && (
                          <div className="text-right">
                            <span className="text-xs font-medium text-gray-500 uppercase">Quantities</span>
                            <p className="font-medium text-teal-600">{product.quantities}</p>
                          </div>
                        )}
                      </div>
                      {product.fields.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-3 border-t border-gray-200">
                          {product.fields.map((field, fieldIndex) => (
                            <div key={fieldIndex}>
                              <span className="text-xs font-medium text-gray-500">{field.label}</span>
                              <p className="text-sm text-gray-800">{field.value}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {parsed.additionalNotes && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <span className="text-xs font-medium text-yellow-800 uppercase">Additional Notes</span>
                    <p className="text-gray-800 mt-1">{parsed.additionalNotes}</p>
                  </div>
                )}
              </div>
            )
          }
          // Fallback to plain text for non-quote-request descriptions
          return (
            <div className="mt-6">
              <div className="text-sm text-gray-600 mb-1">Description</div>
              <p className="text-gray-800 whitespace-pre-wrap">{opportunity.description}</p>
            </div>
          )
        })()}
        {opportunity.notes && (
          <div className="mt-6">
            <div className="text-sm text-gray-600 mb-1">Notes</div>
            <p className="text-gray-800 whitespace-pre-wrap">{opportunity.notes}</p>
          </div>
        )}
      </div>

      {/* Attachments Section */}
      {opportunity.metadata?.attachments && opportunity.metadata.attachments.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">
            Attachments ({opportunity.metadata.attachments.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {opportunity.metadata.attachments.map((attachment, index) => (
              <a
                key={index}
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 hover:border-teal-300 transition-colors group"
              >
                <div className="shrink-0 w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                  {attachment.originalName.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ) : attachment.originalName.match(/\.pdf$/i) ? (
                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate group-hover:text-teal-600">
                    {attachment.originalName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {attachment.size < 1024
                      ? `${attachment.size} B`
                      : attachment.size < 1024 * 1024
                        ? `${(attachment.size / 1024).toFixed(1)} KB`
                        : `${(attachment.size / (1024 * 1024)).toFixed(1)} MB`}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-400 group-hover:text-teal-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Quotes Section */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Quotes</h2>
          <Link href={`/crm/quotes/new?opportunityId=${opportunity.id}`}>
            <Button className="bg-teal-600 hover:bg-teal-700">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Quote
            </Button>
          </Link>
        </div>

        {opportunity.quotes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mb-2">No quotes yet</p>
            <p className="text-sm">Create your first quote for this opportunity.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quote #</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunity.quotes.map((quote) => {
                const quoteStatusConfig = QUOTE_STATUS_CONFIG[quote.status] || { label: quote.status, color: 'bg-gray-100' }
                return (
                  <TableRow key={quote.id}>
                    <TableCell>
                      <Link
                        href={`/crm/quotes/${quote.id}`}
                        className="font-mono font-medium text-teal-600 hover:underline"
                      >
                        {quote.quoteNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">v{quote.version}</Badge>
                    </TableCell>
                    <TableCell>{quote.title || '-'}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(quote.total)}</TableCell>
                    <TableCell>
                      <Badge className={quoteStatusConfig.color}>
                        {quoteStatusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {quote.validUntil ? formatDate(quote.validUntil) : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(quote.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/crm/quotes/${quote.id}`}>
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
    </div>
  )
}
