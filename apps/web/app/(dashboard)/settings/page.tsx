'use client'

import { useState } from 'react'
import { UsersSettings } from '@/components/settings/UsersSettings'
import { ActiveSessionsSettings } from '@/components/settings/ActiveSessionsSettings'

type Tab = 'users' | 'sessions' | 'teams' | 'billing' | 'security'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('users')

  const tabs = [
    { id: 'users' as Tab, name: 'Users', icon: '👥' },
    { id: 'sessions' as Tab, name: 'Active Sessions', icon: '🔐' },
    { id: 'teams' as Tab, name: 'Teams', icon: '🏢', disabled: true },
    { id: 'billing' as Tab, name: 'Billing', icon: '💳', disabled: true },
    { id: 'security' as Tab, name: 'Security', icon: '🔒', disabled: true },
  ]

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your organization settings and preferences</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`
                flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : tab.disabled
                    ? 'border-transparent text-gray-400 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <span>{tab.icon}</span>
              {tab.name}
              {tab.disabled && (
                <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                  Coming Soon
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'users' && <UsersSettings />}
        {activeTab === 'sessions' && <ActiveSessionsSettings />}
        {activeTab === 'teams' && <div className="text-gray-500">Teams settings coming soon...</div>}
        {activeTab === 'billing' && <div className="text-gray-500">Billing settings coming soon...</div>}
        {activeTab === 'security' && <div className="text-gray-500">Security settings coming soon...</div>}
      </div>
    </div>
  )
}
