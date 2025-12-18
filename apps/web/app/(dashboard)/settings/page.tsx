'use client'

import { useState } from 'react'
import { UsersSettings } from '@/components/settings/UsersSettings'
import { ActiveSessionsSettings } from '@/components/settings/ActiveSessionsSettings'
import { IntegrationsSettings } from '@/components/settings/IntegrationsSettings'
import { ShipmentTypesSettings } from '@/components/settings/ShipmentTypesSettings'
import { MenuConfigurationSettings } from '@/components/settings/MenuConfigurationSettings'
import { PortalPagesSettings } from '@/components/settings/PortalPagesSettings'
import { DepartmentsSettings } from '@/components/settings/DepartmentsSettings'
import { EstimateSettings } from '@/components/settings/EstimateSettings'
import { SecuritySettings } from '@/components/settings/SecuritySettings'
import { ModulesSettings } from '@/components/settings/ModulesSettings'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  KeyRound,
  Plug,
  Package,
  Menu,
  Globe,
  Building2,
  FileText,
  Shield,
  UsersRound,
  CreditCard,
  Settings,
  ChevronRight,
  Boxes,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'users' | 'sessions' | 'integrations' | 'shipment-types' | 'menu-config' | 'portal-pages' | 'departments' | 'estimates' | 'teams' | 'billing' | 'security' | 'modules'

interface TabItem {
  id: Tab
  name: string
  description: string
  icon: React.ElementType
  disabled?: boolean
  category: 'general' | 'configuration' | 'security' | 'modules'
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('users')

  const tabs: TabItem[] = [
    { id: 'users', name: 'Users', description: 'Manage team members', icon: Users, category: 'general' },
    { id: 'sessions', name: 'Active Sessions', description: 'Monitor login activity', icon: KeyRound, category: 'general' },
    { id: 'integrations', name: 'Integrations', description: 'Connect third-party services', icon: Plug, category: 'general' },
    { id: 'shipment-types', name: 'Shipment Settings', description: 'Configure shipping options', icon: Package, category: 'configuration' },
    { id: 'menu-config', name: 'Navigation Menu', description: 'Customize menu structure', icon: Menu, category: 'configuration' },
    { id: 'portal-pages', name: 'Portal Pages', description: 'Manage portal content', icon: Globe, category: 'configuration' },
    { id: 'departments', name: 'Departments', description: 'Organize teams and roles', icon: Building2, category: 'configuration' },
    { id: 'estimates', name: 'Estimates', description: 'Quote configuration', icon: FileText, category: 'configuration' },
    { id: 'security', name: 'Security', description: 'Authentication & secrets', icon: Shield, category: 'security' },
    { id: 'modules', name: 'Modules', description: 'Enable/disable features', icon: Boxes, category: 'modules' },
    { id: 'teams', name: 'Teams', description: 'Team collaboration', icon: UsersRound, disabled: true, category: 'general' },
    { id: 'billing', name: 'Billing', description: 'Subscription & payments', icon: CreditCard, disabled: true, category: 'general' },
  ]

  const categories = [
    { id: 'general', name: 'General', tabs: tabs.filter(t => t.category === 'general') },
    { id: 'configuration', name: 'Configuration', tabs: tabs.filter(t => t.category === 'configuration') },
    { id: 'modules', name: 'Modules', tabs: tabs.filter(t => t.category === 'modules') },
    { id: 'security', name: 'Security & Access', tabs: tabs.filter(t => t.category === 'security') },
  ]

  const activeTabData = tabs.find(t => t.id === activeTab)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50 to-blue-50/30">
      <div className="p-6 lg:p-8">
        {/* Premium Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
              <p className="text-sm text-gray-500">Manage your organization settings and preferences</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Premium Sidebar Navigation */}
          <aside className="lg:w-72 flex-shrink-0">
            <Card className="sticky top-6 overflow-hidden border-0 shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-sm">
              <div className="p-4 space-y-6">
                {categories.map((category) => (
                  <div key={category.id}>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
                      {category.name}
                    </h3>
                    <nav className="space-y-1">
                      {category.tabs.map((tab) => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                          <button
                            key={tab.id}
                            onClick={() => !tab.disabled && setActiveTab(tab.id)}
                            disabled={tab.disabled}
                            className={cn(
                              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group',
                              isActive
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25'
                                : tab.disabled
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                            )}
                          >
                            <div className={cn(
                              'p-1.5 rounded-lg transition-colors',
                              isActive
                                ? 'bg-white/20'
                                : tab.disabled
                                ? 'bg-gray-100'
                                : 'bg-gray-100 group-hover:bg-gray-200'
                            )}>
                              <Icon className={cn(
                                'h-4 w-4',
                                isActive ? 'text-white' : tab.disabled ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-700'
                              )} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  'font-medium text-sm truncate',
                                  isActive ? 'text-white' : ''
                                )}>
                                  {tab.name}
                                </span>
                                {tab.disabled && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-gray-100 text-gray-400 border-0">
                                    Soon
                                  </Badge>
                                )}
                              </div>
                              <p className={cn(
                                'text-xs truncate mt-0.5',
                                isActive ? 'text-blue-100' : 'text-gray-400'
                              )}>
                                {tab.description}
                              </p>
                            </div>
                            {isActive && (
                              <ChevronRight className="h-4 w-4 text-white/70" />
                            )}
                          </button>
                        )
                      })}
                    </nav>
                  </div>
                ))}
              </div>
            </Card>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            <Card className="border-0 shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-sm rounded-2xl">
              {/* Content Header */}
              {activeTabData && (
                <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50/50 to-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg">
                      <activeTabData.icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">{activeTabData.name}</h2>
                      <p className="text-sm text-gray-500">{activeTabData.description}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'users' && <UsersSettings />}
                {activeTab === 'sessions' && <ActiveSessionsSettings />}
                {activeTab === 'integrations' && <IntegrationsSettings />}
                {activeTab === 'shipment-types' && <ShipmentTypesSettings />}
                {activeTab === 'menu-config' && <MenuConfigurationSettings />}
                {activeTab === 'portal-pages' && <PortalPagesSettings />}
                {activeTab === 'departments' && <DepartmentsSettings />}
                {activeTab === 'estimates' && <EstimateSettings />}
                {activeTab === 'security' && <SecuritySettings />}
                {activeTab === 'modules' && <ModulesSettings />}
                {activeTab === 'teams' && (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl mb-4">
                      <UsersRound className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Teams Coming Soon</h3>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                      Team collaboration features are currently in development. Stay tuned for updates.
                    </p>
                  </div>
                )}
                {activeTab === 'billing' && (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl mb-4">
                      <CreditCard className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Billing Coming Soon</h3>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                      Subscription management and payment features are currently in development.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </main>
        </div>
      </div>
    </div>
  )
}
