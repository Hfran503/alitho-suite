'use client'

import { useState, useEffect, Fragment } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw, Search, ChevronDown, ChevronUp } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type JobProductType = Record<string, any>

export default function JobProductTypesPage() {
  const [jobProductTypes, setJobProductTypes] = useState<JobProductType[]>([])
  const [filteredTypes, setFilteredTypes] = useState<JobProductType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // Cache key
  const CACHE_KEY = 'job_product_types_cache'
  const CACHE_TIMESTAMP_KEY = 'job_product_types_cache_timestamp'
  const CACHE_DURATION_MS = 15 * 60 * 1000 // 15 minutes

  // Load cached data on mount
  useEffect(() => {
    const cachedData = localStorage.getItem(CACHE_KEY)
    const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)

    console.log('Cache check:', { cachedData: cachedData?.substring(0, 100), cachedTimestamp })

    if (cachedData && cachedTimestamp) {
      const cacheAge = Date.now() - new Date(cachedTimestamp).getTime()
      console.log('Cache age (ms):', cacheAge, 'Valid:', cacheAge < CACHE_DURATION_MS)
      if (cacheAge < CACHE_DURATION_MS) {
        const parsed = JSON.parse(cachedData)
        console.log('Using cached data, length:', parsed.length)
        setJobProductTypes(parsed)
        setFilteredTypes(parsed)
        setLastFetchTime(new Date(cachedTimestamp))
        return
      }
    }

    // If no valid cache, fetch data
    console.log('No valid cache, fetching from API')
    fetchJobProductTypes()
  }, [])

  // Filter data when search term changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredTypes(jobProductTypes)
      return
    }

    const term = searchTerm.toLowerCase()
    const filtered = jobProductTypes.filter((type) => {
      return Object.entries(type).some(([key, value]) => {
        if (value === null || value === undefined) return false
        return String(value).toLowerCase().includes(term) || key.toLowerCase().includes(term)
      })
    })
    setFilteredTypes(filtered)
  }, [searchTerm, jobProductTypes])

  const fetchJobProductTypes = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/pace/job-product-types')
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch JobProductTypes')
      }

      const result = await response.json()
      const items = result.data?.items || []

      setJobProductTypes(items)
      setFilteredTypes(items)
      setLastFetchTime(new Date())

      // Cache the data
      localStorage.setItem(CACHE_KEY, JSON.stringify(items))
      localStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().toISOString())
    } catch (err) {
      console.error('Error fetching JobProductTypes:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const toggleRowExpansion = (index: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedRows(newExpanded)
  }

  const getAllFieldNames = (): string[] => {
    const fieldsSet = new Set<string>()
    jobProductTypes.forEach((type) => {
      Object.keys(type).forEach((key) => fieldsSet.add(key))
    })
    return Array.from(fieldsSet).sort()
  }

  const renderFieldValue = (value: any): string => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  const getFieldType = (value: any): string => {
    if (value === null || value === undefined) return 'null'
    if (Array.isArray(value)) return 'array'
    return typeof value
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Job Product Types</h1>
          <p className="text-muted-foreground mt-1">
            View all JobProductType field information from PACE API
          </p>
        </div>
        <Button onClick={fetchJobProductTypes} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle>Summary</CardTitle>
          <CardDescription>Overview of JobProductType data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Records</p>
              <p className="text-2xl font-bold">{jobProductTypes.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Unique Fields</p>
              <p className="text-2xl font-bold">{getAllFieldNames().length}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
              <p className="text-sm font-medium">
                {lastFetchTime ? lastFetchTime.toLocaleString() : 'Never'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fields and values..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="secondary">
          {filteredTypes.length} of {jobProductTypes.length}
        </Badge>
      </div>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Job Product Types</CardTitle>
          <CardDescription>
            Click on a row to expand and view all field details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && jobProductTypes.length === 0 ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredTypes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {jobProductTypes.length === 0
                ? 'No JobProductTypes found. Click Refresh to load data.'
                : 'No results match your search.'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Fields</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTypes.map((type, index) => {
                    const isExpanded = expandedRows.has(index)
                    const fields = Object.keys(type)
                    const uniqueKey = type.id || type.primaryKey || `type-${index}`

                    return (
                      <Fragment key={uniqueKey}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleRowExpansion(index)}
                        >
                          <TableCell>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {type.id || type.primaryKey || '-'}
                          </TableCell>
                          <TableCell>
                            {type.description || type.name || type.code || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">JobProductType</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{fields.length}</Badge>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={5} className="bg-muted/30">
                              <div className="p-4 space-y-4">
                                <h4 className="font-semibold text-sm mb-3">All Fields:</h4>
                                <div className="grid grid-cols-1 gap-3">
                                  {Object.entries(type)
                                    .sort(([a], [b]) => a.localeCompare(b))
                                    .map(([key, value]) => (
                                      <div
                                        key={key}
                                        className="grid grid-cols-3 gap-4 py-2 border-b last:border-b-0"
                                      >
                                        <div className="font-mono text-sm font-medium">
                                          {key}
                                        </div>
                                        <div className="text-sm font-mono text-muted-foreground">
                                          <Badge variant="outline" className="text-xs">
                                            {getFieldType(value)}
                                          </Badge>
                                        </div>
                                        <div className="text-sm font-mono break-all">
                                          {renderFieldValue(value)}
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Unique Fields Reference */}
      {jobProductTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Unique Fields</CardTitle>
            <CardDescription>
              Complete list of all field names found across all JobProductType records
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {getAllFieldNames().map((field) => (
                <Badge key={field} variant="secondary" className="font-mono text-xs">
                  {field}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
