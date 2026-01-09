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

interface QuoteItem {
  id: string
  name: string
  description: string | null
  quantity: number
  unitPrice: string
  total: string
  sortOrder: number
}

interface Quote {
  id: string
  quoteNumber: string
  version: number
  title: string | null
  description: string | null
  subtotal: string
  tax: string
  total: string
  status: string
  validUntil: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  contact: {
    id: string
    firstName: string
    lastName: string
    email: string
    company: string | null
  }
  opportunity: {
    id: string
    opportunityNumber: string
    title: string
  } | null
  items: QuoteItem[]
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800' },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-800' },
  accepted: { label: 'Accepted', color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  expired: { label: 'Expired', color: 'bg-orange-100 text-orange-800' },
}

export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [itemFormData, setItemFormData] = useState({
    name: '',
    description: '',
    quantity: '1',
    unitPrice: '0',
  })

  useEffect(() => {
    async function fetchQuote() {
      try {
        const response = await fetch(`/api/crm/quotes/${id}`)
        if (!response.ok) {
          throw new Error('Failed to fetch quote')
        }
        const data = await response.json()
        setQuote(data.data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchQuote()
  }, [id])

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/crm/quotes/${id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: itemFormData.name,
          description: itemFormData.description || null,
          quantity: Number(itemFormData.quantity),
          unitPrice: Number(itemFormData.unitPrice),
          sortOrder: quote?.items.length || 0,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add item')
      }

      // Refresh quote
      const quoteResponse = await fetch(`/api/crm/quotes/${id}`)
      const quoteData = await quoteResponse.json()
      setQuote(quoteData.data)

      setItemFormData({ name: '', description: '', quantity: '1', unitPrice: '0' })
      setItemDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/crm/quotes/${id}/items/${itemId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete item')
      }

      // Refresh quote
      const quoteResponse = await fetch(`/api/crm/quotes/${id}`)
      const quoteData = await quoteResponse.json()
      setQuote(quoteData.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDuplicate = async () => {
    if (!confirm('Create a new version of this quote?')) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/crm/quotes/${id}/duplicate`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to duplicate quote')
      }

      const data = await response.json()
      router.push(`/crm/quotes/${data.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setSubmitting(false)
    }
  }

  const handleStatusUpdate = async (newStatus: string) => {
    setSubmitting(true)
    try {
      const response = await fetch(`/api/crm/quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update status')
      }

      const data = await response.json()
      setQuote(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteQuote = async () => {
    if (!confirm('Are you sure you want to delete this quote? This action cannot be undone.')) return

    setSubmitting(true)
    try {
      const response = await fetch(`/api/crm/quotes/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete quote')
      }

      router.push('/crm/quotes')
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

  if (error || !quote) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error || 'Quote not found'}</p>
        <Link href="/crm/quotes">
          <Button variant="outline" className="mt-4">
            Back to Quotes
          </Button>
        </Link>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[quote.status] || { label: quote.status, color: 'bg-gray-100' }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/crm/quotes">
            <Button variant="ghost" size="sm" className="mb-2">
              ← Back to Quotes
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{quote.quoteNumber}</h1>
            <Badge variant="outline">v{quote.version}</Badge>
            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
          </div>
          {quote.title && <p className="text-gray-600 mt-1">{quote.title}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDuplicate} disabled={submitting}>
            Duplicate to New Version
          </Button>
          {quote.status === 'draft' && (
            <>
              <Button onClick={() => handleStatusUpdate('sent')} disabled={submitting} className="bg-teal-600 hover:bg-teal-700">
                Mark as Sent
              </Button>
              <Button variant="destructive" onClick={deleteQuote} disabled={submitting}>
                Delete
              </Button>
            </>
          )}
          {quote.status === 'sent' && (
            <>
              <Button onClick={() => handleStatusUpdate('accepted')} disabled={submitting} className="bg-green-600 hover:bg-green-700">
                Accept
              </Button>
              <Button onClick={() => handleStatusUpdate('rejected')} disabled={submitting} variant="destructive">
                Reject
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Contact & Opportunity Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-gray-600 mb-1">Contact</div>
            <Link
              href={`/crm/contacts/${quote.contact.id}`}
              className="text-teal-600 hover:underline font-medium"
            >
              {quote.contact.firstName} {quote.contact.lastName}
            </Link>
            {quote.contact.company && (
              <div className="text-sm text-gray-500">{quote.contact.company}</div>
            )}
            <a href={`mailto:${quote.contact.email}`} className="text-sm text-teal-600 hover:underline">
              {quote.contact.email}
            </a>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Opportunity</div>
            {quote.opportunity ? (
              <Link
                href={`/crm/opportunities/${quote.opportunity.id}`}
                className="text-teal-600 hover:underline font-medium"
              >
                {quote.opportunity.opportunityNumber}
              </Link>
            ) : (
              <span className="text-gray-400">Not linked</span>
            )}
            {quote.opportunity && (
              <div className="text-sm text-gray-500">{quote.opportunity.title}</div>
            )}
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Valid Until</div>
            <div>{quote.validUntil ? formatDate(quote.validUntil) : 'No expiration'}</div>
            <div className="text-sm text-gray-500">Created {formatDate(quote.createdAt)}</div>
          </div>
        </div>
        {quote.description && (
          <div className="mt-6 pt-6 border-t">
            <div className="text-sm text-gray-600 mb-1">Description</div>
            <p className="text-gray-800">{quote.description}</p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">Line Items</h2>
          {quote.status === 'draft' && (
            <>
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                onClick={() => setItemDialogOpen(true)}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Item
              </Button>
              <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
                <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Line Item</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddItem} className="space-y-4 mt-4">
                  <div>
                    <Label htmlFor="name">Item Name *</Label>
                    <Input
                      id="name"
                      required
                      value={itemFormData.name}
                      onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                      placeholder="e.g., Box Printing"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={itemFormData.description}
                      onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                      placeholder="Optional item description"
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="quantity">Quantity *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        required
                        value={itemFormData.quantity}
                        onChange={(e) => setItemFormData({ ...itemFormData, quantity: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="unitPrice">Unit Price *</Label>
                      <Input
                        id="unitPrice"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={itemFormData.unitPrice}
                        onChange={(e) => setItemFormData({ ...itemFormData, unitPrice: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setItemDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting} className="bg-teal-600 hover:bg-teal-700">
                      {submitting ? 'Adding...' : 'Add Item'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            </>
          )}
        </div>

        {quote.items.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="mb-2">No line items yet</p>
            <p className="text-sm">Add items to build your quote.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
                {quote.status === 'draft' && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {quote.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                    {item.description && (
                      <div className="text-sm text-gray-500">{item.description}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                  {quote.status === 'draft' && (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteItem(item.id)}
                        disabled={submitting}
                      >
                        Delete
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pricing Summary */}
        <div className="border-t p-6">
          <div className="flex flex-col items-end space-y-2 max-w-sm ml-auto">
            <div className="flex justify-between w-full">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between w-full">
              <span className="text-gray-600">Tax:</span>
              <span className="font-medium">{formatCurrency(quote.tax)}</span>
            </div>
            <div className="flex justify-between w-full text-lg font-bold pt-2 border-t">
              <span>Total:</span>
              <span className="text-teal-600">{formatCurrency(quote.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {quote.notes && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Notes</h2>
          <p className="text-gray-800 whitespace-pre-wrap">{quote.notes}</p>
        </div>
      )}

      {quote.status !== 'draft' && (
        <div className="mt-6 text-sm text-gray-600">
          Note: Only draft quotes can be edited or deleted.
        </div>
      )}
    </div>
  )
}
