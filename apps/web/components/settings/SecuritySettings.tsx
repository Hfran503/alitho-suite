'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';

export function SecuritySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [maskedSecret, setMaskedSecret] = useState('');
  const [cronSecret, setCronSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCronSecret();
  }, []);

  const fetchCronSecret = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/settings/cron-secret');
      const data = await response.json();

      if (data.success) {
        setConfigured(data.data.configured);
        setMaskedSecret(data.data.maskedSecret || '');
      } else {
        throw new Error(data.error || 'Failed to fetch cron secret');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const generateSecret = () => {
    // Generate a random secret (32 bytes = 44 base64 characters)
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const secret = btoa(String.fromCharCode(...array));
    setCronSecret(secret);
    setShowSecret(true);
  };

  const handleSave = async () => {
    if (!cronSecret) {
      setError('Please enter or generate a CRON_SECRET');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/settings/cron-secret', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cronSecret }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('CRON_SECRET saved successfully to AWS Secrets Manager!');
        setCronSecret('');
        setShowSecret(false);
        await fetchCronSecret();
      } else {
        throw new Error(data.error || 'Failed to save cron secret');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(cronSecret);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(null), 2000);
  };

  if (loading) {
    return <div className="text-gray-600">Loading security settings...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cron Job Authentication</CardTitle>
          <CardDescription>
            Manage the secret used to authenticate automated cron jobs (like Atlassian Orders email checking).
            This secret is stored securely in AWS Secrets Manager.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Status */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Current Status</p>
                <p className="text-sm text-gray-600 mt-1">
                  {configured ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                      Configured: {maskedSecret}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full"></span>
                      Not configured
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Stored in: <code className="bg-gray-200 px-1 rounded">calitho-suite/cron</code>
                </p>
              </div>
            </div>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert className="bg-red-50 border-red-200">
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {/* Secret Input */}
          <div className="space-y-2">
            <Label htmlFor="cronSecret">CRON_SECRET</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="cronSecret"
                  type={showSecret ? 'text' : 'password'}
                  value={cronSecret}
                  onChange={(e) => setCronSecret(e.target.value)}
                  placeholder="Enter or generate a new secret"
                  className="pr-10"
                />
                {cronSecret && (
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              </div>
              <Button type="button" variant="outline" onClick={generateSecret}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate
              </Button>
              {cronSecret && (
                <Button type="button" variant="outline" onClick={copyToClipboard}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              )}
            </div>
            <p className="text-sm text-gray-600">
              A secure random string used to authenticate automated cron jobs. Minimum 32 characters.
            </p>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <Button onClick={handleSave} disabled={!cronSecret || saving}>
              {saving ? 'Saving...' : configured ? 'Update Secret' : 'Save Secret'}
            </Button>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">
              📋 How to use this secret in Dokploy Schedule Jobs:
            </h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Generate or enter a secret above and click "Save Secret"</li>
              <li>Go to Dokploy → Your App → Schedule Jobs</li>
              <li>In your cron script, use: <code className="bg-blue-100 px-1 rounded">Authorization: Bearer YOUR_SECRET</code></li>
              <li>The API will fetch and verify the secret from AWS Secrets Manager automatically</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
