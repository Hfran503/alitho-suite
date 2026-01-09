'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
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

interface Contact {
  id: string
  firstName: string
  lastName: string
  email: string
  company: string | null
}

interface Opportunity {
  id: string
  opportunityNumber: string
  title: string
  contact: {
    id: string
    firstName: string
    lastName: string
  }
}

interface LineItem {
  tempId: string
  name: string
  description: string
  quantity: number
  unitPrice: number
}

export default function NewQuotePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedOpportunityId = searchParams.get('opportunityId')
  const preselectedContactId = searchParams.get('contactId')

  const [contacts, setContacts] = useState<Contact[]>([])
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<LineItem[]>([])
  const [nextTempId, setNextTempId] = useState(1)
  const [contactDialogOpen, setContactDialogOpen] = useState(false)
  const [contactSubmitting, setContactSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    contactId: preselectedContactId || '',
    opportunityId: preselectedOpportunityId || '',
    title: '',
    description: '',
    tax: '0',
    validUntil: '',
    notes: '',
  })

  const [itemFormData, setItemFormData] = useState({
    name: '',
    description: '',
    quantity: '1',
    unitPrice: '0',
  })

  const [contactFormData, setContactFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    title: '',
  })

  const fetchContacts = async () => {
    try {
      const response = await fetch('/api/crm/contacts?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setContacts(data.data || [])
      }
    } catch (err) {
      console.error('Error fetching contacts:', err)
    }
  }

  useEffect(() => {
    async function fetchData() {
      try {
        await fetchContacts()

        const oppsRes = await fetch('/api/crm/opportunities?limit=1000')
        if (oppsRes.ok) {
          const data = await oppsRes.json()
          setOpportunities(data.data || [])
        }
      } catch (err) {
        console.error('Error fetching data:', err)
      }
    }
    fetchData()
  }, [])

  // Auto-select contact if opportunity is selected
  useEffect(() => {
    if (formData.opportunityId) {
      const opp = opportunities.find((o) => o.id === formData.opportunityId)
      if (opp && opp.contact) {
        setFormData((prev) => ({ ...prev, contactId: opp.contact.id }))
      }
    }
  }, [formData.opportunityId, opportunities])

  const handleAddItem = () => {
    // Validate required fields
    if (!itemFormData.name || !itemFormData.quantity || !itemFormData.unitPrice) {
      return
    }

    const newItem: LineItem = {
      tempId: `temp_${nextTempId}`,
      name: itemFormData.name,
      description: itemFormData.description,
      quantity: Number(itemFormData.quantity),
      unitPrice: Number(itemFormData.unitPrice),
    }

    setItems([...items, newItem])
    setNextTempId(nextTempId + 1)
    setItemFormData({ name: '', description: '', quantity: '1', unitPrice: '0' })
  }

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setContactSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactFormData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create contact')
      }

      const data = await response.json()

      // Refresh contacts list and select the new contact
      await fetchContacts()
      setFormData({ ...formData, contactId: data.data.id })

      // Reset form and close dialog
      setContactFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        title: '',
      })
      setContactDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setContactSubmitting(false)
    }
  }

  const handleRemoveItem = (tempId: string) => {
    setItems(items.filter((item) => item.tempId !== tempId))
  }

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  }

  const calculateTotal = () => {
    return calculateSubtotal() + Number(formData.tax)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (items.length === 0) {
      setError('Please add at least one line item')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/crm/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: formData.contactId,
          opportunityId: formData.opportunityId || undefined,
          title: formData.title || undefined,
          description: formData.description || undefined,
          tax: Number(formData.tax),
          validUntil: formData.validUntil || undefined,
          notes: formData.notes || undefined,
          items: items.map((item) => ({
            name: item.name,
            description: item.description || undefined,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create quote')
      }

      const data = await response.json()
      router.push(`/crm/quotes/${data.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/crm/quotes">
          <Button variant="ghost" size="sm" className="mb-2">
            ← Back to Quotes
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Create New Quote</h1>
        <p className="text-gray-600">Build a pricing proposal for your customer</p>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-800">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Quote Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Quote Information</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="opportunityId">Opportunity (Optional)</Label>
                <Select
                  value={formData.opportunityId || 'none'}
                  onValueChange={(v) => setFormData({ ...formData, opportunityId: v === 'none' ? '' : v })}
                >
                  <SelectTrigger id="opportunityId">
                    <SelectValue placeholder="Select opportunity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {opportunities.map((opp) => (
                      <SelectItem key={opp.id} value={opp.id}>
                        {opp.opportunityNumber} - {opp.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="contactId">Contact *</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      value={formData.contactId}
                      onValueChange={(v) => setFormData({ ...formData, contactId: v })}
                      required
                    >
                      <SelectTrigger id="contactId">
                        <SelectValue placeholder="Select contact" />
                      </SelectTrigger>
                      <SelectContent>
                        {contacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.firstName} {contact.lastName}
                            {contact.company && ` - ${contact.company}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-shrink-0"
                    onClick={() => setContactDialogOpen(true)}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    New Contact
                  </Button>
                  <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Create New Contact</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateContact} className="space-y-4 mt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="firstName">First Name *</Label>
                            <Input
                              id="firstName"
                              required
                              value={contactFormData.firstName}
                              onChange={(e) => setContactFormData({ ...contactFormData, firstName: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label htmlFor="lastName">Last Name *</Label>
                            <Input
                              id="lastName"
                              required
                              value={contactFormData.lastName}
                              onChange={(e) => setContactFormData({ ...contactFormData, lastName: e.target.value })}
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="email">Email *</Label>
                          <Input
                            id="email"
                            type="email"
                            required
                            value={contactFormData.email}
                            onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="phone">Phone</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={contactFormData.phone}
                            onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="company">Company</Label>
                          <Input
                            id="company"
                            value={contactFormData.company}
                            onChange={(e) => setContactFormData({ ...contactFormData, company: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="contactTitle">Title</Label>
                          <Input
                            id="contactTitle"
                            value={contactFormData.title}
                            onChange={(e) => setContactFormData({ ...contactFormData, title: e.target.value })}
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                          <Button type="button" variant="outline" onClick={() => setContactDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" disabled={contactSubmitting} className="bg-teal-600 hover:bg-teal-700">
                            {contactSubmitting ? 'Creating...' : 'Create Contact'}
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="title">Quote Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Packaging Printing Quote"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this quote"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="tax">Tax Amount (USD)</Label>
                <Input
                  id="tax"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.tax}
                  onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="validUntil">Valid Until</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={formData.validUntil}
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Internal notes"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Line Items</h2>
          </div>

          {/* Add Item Form */}
          <div className="p-6 border-b bg-gray-50">
            <div className="space-y-4">
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-4">
                  <Label htmlFor="itemName">Item Name *</Label>
                  <Input
                    id="itemName"
                    value={itemFormData.name}
                    onChange={(e) => setItemFormData({ ...itemFormData, name: e.target.value })}
                    placeholder="e.g., Box Printing"
                  />
                </div>
                <div className="col-span-3">
                  <Label htmlFor="itemDescription">Description</Label>
                  <Input
                    id="itemDescription"
                    value={itemFormData.description}
                    onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="itemQuantity">Quantity *</Label>
                  <Input
                    id="itemQuantity"
                    type="number"
                    min="1"
                    value={itemFormData.quantity}
                    onChange={(e) => setItemFormData({ ...itemFormData, quantity: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="itemUnitPrice">Unit Price *</Label>
                  <Input
                    id="itemUnitPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    value={itemFormData.unitPrice}
                    onChange={(e) => setItemFormData({ ...itemFormData, unitPrice: e.target.value })}
                  />
                </div>
                <div className="col-span-1 flex items-end">
                  <Button
                    type="button"
                    onClick={handleAddItem}
                    className="w-full bg-teal-600 hover:bg-teal-700"
                    disabled={!itemFormData.name || !itemFormData.quantity || !itemFormData.unitPrice}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          {items.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="mb-2">No line items yet</p>
              <p className="text-sm">Use the form above to add items to your quote.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.tempId}>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      {item.description && (
                        <div className="text-sm text-gray-500">{item.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.tempId)}
                      >
                        Remove
                      </Button>
                    </TableCell>
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
                <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between w-full">
                <span className="text-gray-600">Tax:</span>
                <span className="font-medium">{formatCurrency(Number(formData.tax))}</span>
              </div>
              <div className="flex justify-between w-full text-lg font-bold pt-2 border-t">
                <span>Total:</span>
                <span className="text-teal-600">{formatCurrency(calculateTotal())}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-2">
          <Link href="/crm/quotes">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={loading || !formData.contactId || items.length === 0} className="bg-teal-600 hover:bg-teal-700">
            {loading ? 'Creating...' : 'Create Quote'}
          </Button>
        </div>
      </form>
    </div>
  )
}
