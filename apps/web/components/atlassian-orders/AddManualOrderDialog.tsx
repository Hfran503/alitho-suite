'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { COUNTRY_CATEGORIES } from './types';

interface AddManualOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOrderCreated: () => void;
}

interface FormData {
  firstName: string;
  lastName: string;
  printName: string;
  personalEmail: string;
  workEmail: string;
  phoneNumber: string;
  address1: string;
  address2: string;
  address3: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  countryCategory: string;
  startDate: string;
  manager: string;
  department: string;
  location: string;
}

const initialFormData: FormData = {
  firstName: '',
  lastName: '',
  printName: '',
  personalEmail: '',
  workEmail: '',
  phoneNumber: '',
  address1: '',
  address2: '',
  address3: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
  countryCategory: '',
  startDate: '',
  manager: '',
  department: '',
  location: '',
};

export function AddManualOrderDialog({
  open,
  onOpenChange,
  onOrderCreated,
}: AddManualOrderDialogProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFieldChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleClose = () => {
    setFormData(initialFormData);
    setError(null);
    setSuccess(null);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.firstName.trim() && !formData.lastName.trim()) {
      setError('First name and last name are required');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/atlassian/orders/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          fullName: `${formData.firstName} ${formData.lastName}`.trim(),
          printName: formData.printName || formData.firstName,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Order created successfully! Order #${data.order.orderNumber}`);
        setTimeout(() => {
          handleClose();
          onOrderCreated();
        }, 1500);
      } else {
        throw new Error(data.error || 'Failed to create order');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Manual Order</DialogTitle>
          <DialogDescription>
            Create a new Atlassian order manually. Required fields are marked with *.
          </DialogDescription>
        </DialogHeader>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-red-800 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3 text-green-800 text-sm">
            {success}
          </div>
        )}

        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          {/* Name Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Employee Name *</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">First Name *</label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => handleFieldChange('firstName', e.target.value)}
                  placeholder="John"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Last Name *</label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => handleFieldChange('lastName', e.target.value)}
                  placeholder="Doe"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-600 mb-1 block">Print Name (for PDF)</label>
                <Input
                  value={formData.printName}
                  onChange={(e) => handleFieldChange('printName', e.target.value)}
                  placeholder="Leave blank to use first name"
                />
              </div>
            </div>
          </div>

          {/* Contact Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Contact Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Personal Email</label>
                <Input
                  type="email"
                  value={formData.personalEmail}
                  onChange={(e) => handleFieldChange('personalEmail', e.target.value)}
                  placeholder="john.doe@gmail.com"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Work Email</label>
                <Input
                  type="email"
                  value={formData.workEmail}
                  onChange={(e) => handleFieldChange('workEmail', e.target.value)}
                  placeholder="john.doe@atlassian.com"
                />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-600 mb-1 block">Phone Number</label>
                <Input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => handleFieldChange('phoneNumber', e.target.value)}
                  placeholder="+1 555-123-4567"
                />
              </div>
            </div>
          </div>

          {/* Address Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Shipping Address</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Address Line 1</label>
                <Input
                  value={formData.address1}
                  onChange={(e) => handleFieldChange('address1', e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Address Line 2</label>
                <Input
                  value={formData.address2}
                  onChange={(e) => handleFieldChange('address2', e.target.value)}
                  placeholder="Apt 4B"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Address Line 3</label>
                <Input
                  value={formData.address3}
                  onChange={(e) => handleFieldChange('address3', e.target.value)}
                  placeholder=""
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">City</label>
                  <Input
                    value={formData.city}
                    onChange={(e) => handleFieldChange('city', e.target.value)}
                    placeholder="San Francisco"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">State / Province</label>
                  <Input
                    value={formData.state}
                    onChange={(e) => handleFieldChange('state', e.target.value)}
                    placeholder="CA"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Zip / Postal Code</label>
                  <Input
                    value={formData.zipCode}
                    onChange={(e) => handleFieldChange('zipCode', e.target.value)}
                    placeholder="94102"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 mb-1 block">Country</label>
                  <Input
                    value={formData.country}
                    onChange={(e) => handleFieldChange('country', e.target.value)}
                    placeholder="United States"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Country Category (for routing)</label>
                <Select
                  value={formData.countryCategory}
                  onValueChange={(value) => handleFieldChange('countryCategory', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.key} value={cat.value as string}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Employment Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Employment Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Start Date</label>
                <Input
                  value={formData.startDate}
                  onChange={(e) => handleFieldChange('startDate', e.target.value)}
                  placeholder="January 15, 2025"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Manager</label>
                <Input
                  value={formData.manager}
                  onChange={(e) => handleFieldChange('manager', e.target.value)}
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Department</label>
                <Input
                  value={formData.department}
                  onChange={(e) => handleFieldChange('department', e.target.value)}
                  placeholder="Engineering"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block">Location</label>
                <Input
                  value={formData.location}
                  onChange={(e) => handleFieldChange('location', e.target.value)}
                  placeholder="San Francisco Office"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              'Create Order'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
