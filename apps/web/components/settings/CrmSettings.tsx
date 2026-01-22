'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Mail, Bell, Users, Loader2, Check, Send } from 'lucide-react';

interface CrmSettingsData {
  id?: string;
  quoteRequestNotificationEmail: string | null;
  enableCustomerEmail: boolean;
  enableInternalEmail: boolean;
}

export function CrmSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState<'customer' | 'internal' | null>(null);
  const [settings, setSettings] = useState<CrmSettingsData>({
    quoteRequestNotificationEmail: '',
    enableCustomerEmail: true,
    enableInternalEmail: true,
  });
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendTestEmail = async (type: 'customer' | 'internal') => {
    setSendingTestEmail(type);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/settings/crm/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setTimeout(() => setSuccess(null), 5000);
      } else {
        throw new Error(data.error || 'Failed to send test email');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSendingTestEmail(null);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/settings/crm');
      const data = await response.json();

      if (response.ok) {
        if (data.crmSettings) {
          setSettings({
            id: data.crmSettings.id,
            quoteRequestNotificationEmail: data.crmSettings.quoteRequestNotificationEmail || '',
            enableCustomerEmail: data.crmSettings.enableCustomerEmail ?? true,
            enableInternalEmail: data.crmSettings.enableInternalEmail ?? true,
          });
        }
      } else {
        throw new Error(data.error || 'Failed to fetch CRM settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/settings/crm', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quoteRequestNotificationEmail: settings.quoteRequestNotificationEmail || null,
          enableCustomerEmail: settings.enableCustomerEmail,
          enableInternalEmail: settings.enableInternalEmail,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('CRM settings saved successfully!');
        if (data.crmSettings) {
          setSettings({
            id: data.crmSettings.id,
            quoteRequestNotificationEmail: data.crmSettings.quoteRequestNotificationEmail || '',
            enableCustomerEmail: data.crmSettings.enableCustomerEmail,
            enableInternalEmail: data.crmSettings.enableInternalEmail,
          });
        }
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error(data.error || 'Failed to save CRM settings');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading CRM settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert className="bg-red-50 border-red-200">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Quote Request Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bell className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Quote Request Notifications</CardTitle>
              <CardDescription>
                Configure email notifications for quote requests submitted through your public form.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Internal Notification Email */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <Label htmlFor="notificationEmail" className="text-sm font-medium">
                Internal Notification Email
              </Label>
            </div>
            <Input
              id="notificationEmail"
              type="text"
              value={settings.quoteRequestNotificationEmail || ''}
              onChange={(e) =>
                setSettings({ ...settings, quoteRequestNotificationEmail: e.target.value })
              }
              placeholder="sales@yourcompany.com, manager@yourcompany.com"
              className="max-w-lg"
            />
            <p className="text-sm text-gray-500">
              Enter one or more email addresses separated by commas. These will receive notifications when new quote requests are submitted.
              Leave empty to disable internal notifications.
            </p>
          </div>

          <div className="border-t pt-6 space-y-4">
            {/* Enable Customer Email */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Mail className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <Label htmlFor="enableCustomerEmail" className="text-sm font-medium">
                      Customer Acknowledgment Email
                    </Label>
                    <p className="text-sm text-gray-500">
                      Send a confirmation email to customers when they submit a quote request.
                    </p>
                  </div>
                </div>
                <Switch
                  id="enableCustomerEmail"
                  checked={settings.enableCustomerEmail}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, enableCustomerEmail: checked })
                  }
                />
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendTestEmail('customer')}
                  disabled={sendingTestEmail !== null}
                  className="text-green-700 border-green-300 hover:bg-green-50"
                >
                  {sendingTestEmail === 'customer' ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3 mr-2" />
                      Send Test Email to Me
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  Sends a sample customer email to your account email address
                </p>
              </div>
            </div>

            {/* Enable Internal Email */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Bell className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <Label htmlFor="enableInternalEmail" className="text-sm font-medium">
                      Internal Team Notification
                    </Label>
                    <p className="text-sm text-gray-500">
                      Send a notification to the internal email when a new quote request is submitted.
                    </p>
                  </div>
                </div>
                <Switch
                  id="enableInternalEmail"
                  checked={settings.enableInternalEmail}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, enableInternalEmail: checked })
                  }
                />
              </div>
              <div className="mt-3 pt-3 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sendTestEmail('internal')}
                  disabled={sendingTestEmail !== null || !settings.quoteRequestNotificationEmail}
                  className="text-purple-700 border-purple-300 hover:bg-purple-50"
                >
                  {sendingTestEmail === 'internal' ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3 mr-2" />
                      Send Test Email
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500 mt-2">
                  {settings.quoteRequestNotificationEmail
                    ? `Sends a sample internal notification to: ${settings.quoteRequestNotificationEmail}`
                    : 'Configure an internal notification email above to send a test'}
                </p>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              Email Configuration Required
            </h4>
            <p className="text-sm text-blue-800">
              Make sure you have configured your email provider in{' '}
              <strong>Settings &rarr; Integrations &rarr; Send Emails</strong> for notifications to
              be sent successfully.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </div>
    </div>
  );
}
