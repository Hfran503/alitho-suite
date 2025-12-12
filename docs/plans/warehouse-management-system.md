# ASN / Warehouse / Receiving / Fulfillment Implementation Plan

> **Project**: Alitho Suite - Warehouse Management System
> **Created**: 2025-12-10
> **Status**: In Progress
> **Approach**: Module-by-Module (complete each module before moving to next)
> **Database Strategy**: Using `prisma db push` (NOT migrations)

---

## Overview

Implement a complete ASN (Advanced Shipping Notice) / Warehouse / Receiving / Fulfillment system that combines:
- **Admin Dashboard**: Full warehouse operations for staff (WAREHOUSE, LOGISTICS, ADMIN roles)
- **Portal**: Vendor ASN submission and customer inventory visibility

---

## Warehouse App Structure

The Warehouse system is implemented as a **separate sub-application** within Alitho Suite, giving it a distinct visual identity while sharing the same codebase.

### Route Structure
```
apps/web/app/(warehouse)/           # Separate route group (NOT under dashboard)
├── layout.tsx                      # Warehouse-specific layout
└── warehouse/
    ├── page.tsx                    # Dashboard: /warehouse
    ├── locations/                  # Module 1: /warehouse/locations
    ├── items/                      # Module 2: /warehouse/items
    ├── inventory/                  # Module 3: /warehouse/inventory
    ├── asn/                        # Module 4: /warehouse/asn
    ├── receiving/                  # Module 5: /warehouse/receiving
    └── fulfillment/                # Module 6: /warehouse/fulfillment
```

### Components Structure
```
apps/web/components/warehouse/
├── WarehouseSidebar.tsx           # Emerald-themed sidebar with "Back to Suite"
├── WarehouseLayoutClient.tsx       # Client layout wrapper
├── locations/                      # Location-specific components
├── items/                          # Item-specific components
├── inventory/                      # Inventory-specific components
├── asn/                            # ASN-specific components
├── receiving/                      # Receiving-specific components
└── fulfillment/                    # Fulfillment-specific components
```

### Visual Identity
- **Color Scheme**: Emerald/Teal gradient (distinct from main Suite's blue theme)
- **Sidebar**: Full-height emerald sidebar with own navigation
- **Navigation**: "Back to Suite" link returns users to main dashboard

---

## Module Progress Tracking

| Module | Status | Last Session | Notes |
|--------|--------|--------------|-------|
| Module 0: Foundation | ✅ Completed | 2025-12-10 | Enums, types, navigation, dashboard page |
| Module 1: Locations | ✅ Completed | 2025-12-10 | CRUD, bulk create, filtering |
| Module 2: Inventory Items | ✅ Completed | 2025-12-10 | InventoryItem model, CRUD, form component |
| Module 3: Inventory Stock | ✅ Completed | 2025-12-10 | Stock levels, transactions, adjust/transfer |
| Module 4: ASN | ✅ Completed | 2025-12-10 | ASN/ASNItem models, status workflow, UI |
| Module 5: Receiving | ✅ Completed | 2025-12-11 | ReceivingRecord/Item models, dock operations UI |
| Module 6: Fulfillment | ⬜ Not Started | - | Pick/Pack/Ship tasks |
| Module 7: Portal | ⬜ Not Started | - | Vendor & Customer views |
| Module 8: Background Jobs | ⬜ Not Started | - | Automation & notifications |

**Legend**: ⬜ Not Started | 🟡 In Progress | ✅ Completed | ⏸️ Blocked

---

## Module 0: Foundation (Prerequisites)

> **Goal**: Set up base enums, types, and navigation structure

### 0.1 Database Enums
**File**: `packages/database/prisma/schema.prisma`

- [ ] Add `LocationType` enum: RECEIVING, STORAGE, SHIPPING, STAGING, QUARANTINE
- [ ] Add `InventoryTransactionType` enum: RECEIVE, SHIP, ADJUST, TRANSFER, RESERVE, UNRESERVE, DAMAGE
- [ ] Add `ASNStatus` enum: DRAFT, PENDING, IN_TRANSIT, ARRIVED, RECEIVING, RECEIVED, CANCELLED, PARTIALLY_RECEIVED
- [ ] Add `ReceivingStatus` enum: IN_PROGRESS, COMPLETED, COMPLETED_WITH_DISCREPANCY
- [ ] Add `TaskType` enum: PICK, PACK, SHIP, PUT_AWAY, COUNT, TRANSFER
- [ ] Add `TaskStatus` enum: PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED

### 0.2 Shared Types
**File**: `packages/types/src/warehouse.ts`

- [ ] Create Zod schemas for all warehouse entities
- [ ] Export TypeScript types

### 0.3 Navigation Updates
**File**: `apps/web/components/DynamicSidebar.tsx`

- [ ] Add "Warehouse" menu section
- [ ] Sub-items: Overview, Locations, Inventory, ASN, Receiving, Fulfillment
- [ ] Role visibility: WAREHOUSE, LOGISTICS, ADMIN, FULL_ADMIN

### 0.4 Warehouse Dashboard Landing
**File**: `apps/web/app/(warehouse)/warehouse/page.tsx`

- [x] Create placeholder dashboard page
- [x] Summary cards (empty for now, will be populated as modules complete)

### 0.5 Sync Database Schema
- [x] Run `prisma db push` to sync schema (NOT migration)

---

## Module 1: Locations (Warehouse Bins/Zones)

> **Goal**: Manage physical warehouse locations where inventory is stored

### 1.1 Database Schema
**File**: `packages/database/prisma/schema.prisma`

- [ ] Create `WarehouseLocation` model:
  ```
  - id, tenantId, warehouseId (Warehouse ref)
  - zone, aisle, rack, shelf, bin
  - barcode (unique), locationType
  - isActive, capacity (optional)
  - timestamps
  ```
- [ ] Add `locations` relation to existing `Warehouse` model
- [ ] Generate migration

### 1.2 API Routes
**Path**: `apps/web/app/api/warehouse/locations/`

- [ ] `route.ts` - GET (list with filters), POST (create)
- [ ] `[id]/route.ts` - GET, PATCH, DELETE
- [ ] `bulk/route.ts` - POST (bulk create locations)
- [ ] `[id]/stock/route.ts` - GET (stock at location) [placeholder until Module 3]

### 1.3 Admin UI
**Path**: `apps/web/app/(warehouse)/warehouse/locations/`

- [ ] `page.tsx` - Location list
  - DataTable with columns: Barcode, Zone, Aisle, Rack, Shelf, Bin, Type, Status
  - Filters: Warehouse, Zone, Type, Status
  - Actions: Edit, Deactivate
- [ ] `new/page.tsx` - Create single location form
- [ ] `[id]/page.tsx` - Location detail/edit
- [ ] `bulk/page.tsx` - Bulk create wizard (generate by pattern)

### 1.4 Components
**Path**: `apps/web/components/warehouse/locations/`

- [ ] `LocationForm.tsx` - Create/edit form
- [ ] `LocationTable.tsx` - DataTable component
- [ ] `BulkLocationGenerator.tsx` - Pattern-based generator (e.g., A01-01-01 to A10-05-04)

### 1.5 Testing & Validation
- [ ] Test CRUD operations
- [ ] Validate barcode uniqueness
- [ ] Test bulk generation

---

## Module 2: Inventory Items (SKU Master)

> **Goal**: Manage product/SKU master data

### 2.1 Database Schema
**File**: `packages/database/prisma/schema.prisma`

- [ ] Create `InventoryItem` model:
  ```
  - id, tenantId
  - sku (unique per tenant), upc
  - name, description, category
  - weight, dimensions (Json)
  - isActive, metadata (Json)
  - timestamps
  ```
- [ ] Add unique constraint: [tenantId, sku]
- [ ] Generate migration

### 2.2 API Routes
**Path**: `apps/web/app/api/warehouse/items/`

- [ ] `route.ts` - GET (list with search), POST (create)
- [ ] `[sku]/route.ts` - GET, PATCH, DELETE
- [ ] `import/route.ts` - POST (bulk import from CSV)
- [ ] `export/route.ts` - GET (export to CSV)

### 2.3 Admin UI
**Path**: `apps/web/app/(warehouse)/warehouse/items/`

- [ ] `page.tsx` - Item list
  - DataTable: SKU, Name, UPC, Category, Weight, Status
  - Search by SKU, name, UPC
  - Actions: Edit, View Stock, Deactivate
- [ ] `new/page.tsx` - Create item form
- [ ] `[sku]/page.tsx` - Item detail/edit (stock levels added in Module 3)
- [ ] `import/page.tsx` - CSV import wizard

### 2.4 Components
**Path**: `apps/web/components/warehouse/items/`

- [ ] `ItemForm.tsx` - Create/edit form with dimensions
- [ ] `ItemTable.tsx` - DataTable component
- [ ] `ItemImportWizard.tsx` - CSV mapping and import
- [ ] `ItemSelect.tsx` - Searchable item/SKU selector (reusable)

### 2.5 Testing & Validation
- [ ] Test CRUD operations
- [ ] Test SKU uniqueness per tenant
- [ ] Test CSV import with various formats

---

## Module 3: Inventory Stock (Quantities & Transactions)

> **Goal**: Track stock levels by location and all movements

### 3.1 Database Schema
**File**: `packages/database/prisma/schema.prisma`

- [ ] Create `InventoryStock` model:
  ```
  - id, tenantId
  - sku, locationId (WarehouseLocation ref)
  - available, reserved, damaged, onHold
  - lotNumber, expirationDate (optional)
  - updatedAt
  - unique: [tenantId, sku, locationId, lotNumber]
  ```
- [ ] Create `InventoryTransaction` model:
  ```
  - id, tenantId
  - sku, locationId
  - type (InventoryTransactionType)
  - quantity (can be negative)
  - previousQty, newQty
  - referenceType, referenceId
  - userId, notes
  - createdAt
  ```
- [ ] Generate migration

### 3.2 API Routes
**Path**: `apps/web/app/api/warehouse/inventory/`

- [ ] `route.ts` - GET (list stock with filters)
- [ ] `sku/[sku]/route.ts` - GET (stock by SKU across all locations)
- [ ] `location/[id]/route.ts` - GET (stock at specific location)
- [ ] `adjust/route.ts` - POST (create adjustment)
- [ ] `transfer/route.ts` - POST (transfer between locations)
- [ ] `transactions/route.ts` - GET (transaction history)

### 3.3 Inventory Service
**File**: `apps/web/lib/services/inventory.ts`

- [ ] `getStockBySku(tenantId, sku)` - Total stock across locations
- [ ] `getStockByLocation(tenantId, locationId)` - All stock at location
- [ ] `adjustStock(params)` - Create adjustment with transaction
- [ ] `transferStock(params)` - Move between locations with transactions
- [ ] `reserveStock(params)` - Reserve for order
- [ ] `releaseReservation(params)` - Release reserved stock

### 3.4 Admin UI
**Path**: `apps/web/app/(warehouse)/warehouse/inventory/`

- [ ] `page.tsx` - Inventory overview
  - DataTable: SKU, Name, Total Qty, Available, Reserved, Damaged, Locations
  - Filters: Warehouse, Category, Low Stock
  - Actions: View Detail, Quick Adjust, Quick Transfer
- [ ] `[sku]/page.tsx` - SKU inventory detail
  - Stock breakdown by location
  - Transaction history
  - Adjust/Transfer forms
- [ ] `adjustments/page.tsx` - Adjustment history and new adjustment form
- [ ] `transfers/page.tsx` - Transfer history and new transfer form
- [ ] `transactions/page.tsx` - Full transaction log with filters

### 3.5 Components
**Path**: `apps/web/components/warehouse/inventory/`

- [ ] `StockTable.tsx` - Stock levels DataTable
- [ ] `AdjustmentForm.tsx` - Adjust stock form (reason code, quantity, notes)
- [ ] `TransferForm.tsx` - Transfer form (from/to location, quantity)
- [ ] `TransactionHistory.tsx` - Transaction list with filters
- [ ] `StockLevelBadge.tsx` - Visual indicator (low/ok/high)

### 3.6 Update Module 1 & 2
- [ ] Update Location detail page to show stock
- [ ] Update Item detail page to show stock by location

### 3.7 Testing & Validation
- [ ] Test stock calculations
- [ ] Verify transaction audit trail
- [ ] Test concurrent stock operations
- [ ] Verify reservation/release logic

---

## Module 4: ASN (Advanced Shipping Notice)

> **Goal**: Create and manage inbound shipment notifications

### 4.1 Database Schema
**File**: `packages/database/prisma/schema.prisma`

- [ ] Create `ASN` model:
  ```
  - id, asnNumber (unique), tenantId
  - vendorId (User ref, optional), vendorName
  - expectedDate, carrier, trackingNumber
  - status (ASNStatus)
  - notes, metadata (Json)
  - timestamps
  ```
- [ ] Create `ASNItem` model:
  ```
  - id, asnId (ASN ref)
  - sku, description
  - expectedQty, receivedQty (default 0)
  - lotNumber, expirationDate (optional)
  - metadata (Json)
  ```
- [ ] Generate migration

### 4.2 API Routes
**Path**: `apps/web/app/api/warehouse/asn/`

- [ ] `route.ts` - GET (list with filters), POST (create)
- [ ] `[id]/route.ts` - GET, PATCH, DELETE
- [ ] `[id]/items/route.ts` - GET, POST, PATCH items
- [ ] `[id]/status/route.ts` - PATCH (update status)
- [ ] `import/route.ts` - POST (import from CSV/EDI)
- [ ] `generate-number/route.ts` - GET (generate next ASN number)

### 4.3 Admin UI
**Path**: `apps/web/app/(warehouse)/warehouse/asn/`

- [ ] `page.tsx` - ASN list
  - DataTable: ASN#, Vendor, Expected Date, Carrier, Status, Items, Actions
  - Filters: Status, Date Range, Vendor
  - Actions: View, Edit, Cancel
- [ ] `new/page.tsx` - Create ASN
  - Vendor selection or manual entry
  - Expected date, carrier, tracking
  - Items table with add/remove
- [ ] `[id]/page.tsx` - ASN detail
  - Header with status workflow
  - Items table (expected vs received)
  - Actions based on status
  - Link to start receiving (→ Module 5)
- [ ] `import/page.tsx` - Import ASN from file

### 4.4 Components
**Path**: `apps/web/components/warehouse/asn/`

- [ ] `ASNForm.tsx` - Create/edit ASN form
- [ ] `ASNTable.tsx` - ASN list DataTable
- [ ] `ASNItemsTable.tsx` - Editable items table
- [ ] `ASNStatusBadge.tsx` - Status indicator with color
- [ ] `ASNStatusWorkflow.tsx` - Status transition controls
- [ ] `ASNImportWizard.tsx` - File import with mapping

### 4.5 Testing & Validation
- [ ] Test ASN CRUD
- [ ] Test ASN number generation
- [ ] Test status transitions
- [ ] Test file import (CSV)

---

## Module 5: Receiving (Dock Operations)

> **Goal**: Process inbound shipments and update inventory

### 5.1 Database Schema
**File**: `packages/database/prisma/schema.prisma`

- [ ] Create `ReceivingRecord` model:
  ```
  - id, tenantId
  - asnId (ASN ref, optional, unique)
  - receivedById (User ref)
  - receivedAt, status (ReceivingStatus)
  - notes, discrepancyNotes
  - timestamps
  ```
- [ ] Create `ReceivingItem` model:
  ```
  - id, receivingRecordId (ReceivingRecord ref)
  - sku, description
  - expectedQty, receivedQty, damagedQty
  - putAwayLocationId (WarehouseLocation ref, optional)
  - lotNumber, expirationDate
  - notes
  ```
- [ ] Add `receivingRecord` relation to ASN model
- [ ] Generate migration

### 5.2 API Routes
**Path**: `apps/web/app/api/warehouse/receiving/`

- [ ] `route.ts` - GET (list receiving sessions), POST (start new)
- [ ] `[id]/route.ts` - GET, PATCH, DELETE
- [ ] `[id]/items/route.ts` - GET, POST (add received item)
- [ ] `[id]/items/[itemId]/route.ts` - PATCH, DELETE
- [ ] `[id]/complete/route.ts` - POST (complete receiving, update inventory)
- [ ] `from-asn/[asnId]/route.ts` - POST (start receiving from ASN)

### 5.3 Receiving Service
**File**: `apps/web/lib/services/receiving.ts`

- [ ] `startReceiving(asnId?)` - Create receiving session
- [ ] `recordItem(params)` - Record received item
- [ ] `completeReceiving(id)` - Complete and update inventory
  - Update ASN status
  - Create inventory transactions
  - Update stock levels
  - Generate put-away tasks (optional)

### 5.4 Admin UI
**Path**: `apps/web/app/(warehouse)/warehouse/receiving/`

- [ ] `page.tsx` - Receiving dashboard
  - Active receiving sessions
  - Pending ASNs (arrived, ready to receive)
  - Quick start buttons
- [ ] `new/page.tsx` - Start receiving (with or without ASN)
- [ ] `[id]/page.tsx` - Receiving session
  - Header: ASN info (if linked), status, receiver
  - Item entry: Scan/search SKU, enter qty, condition
  - Expected vs Received comparison (if ASN)
  - Put-away location assignment
  - Complete button with confirmation

### 5.5 Components
**Path**: `apps/web/components/warehouse/receiving/`

- [ ] `ReceivingSession.tsx` - Main receiving interface
- [ ] `ReceiveItemForm.tsx` - Item entry form (scan-friendly)
- [ ] `ReceivingItemsTable.tsx` - Items received table
- [ ] `DiscrepancyReport.tsx` - Expected vs received summary
- [ ] `PutAwayAssignment.tsx` - Assign locations to items
- [ ] `ReceivingComplete.tsx` - Completion confirmation dialog

### 5.6 Update ASN Module
- [ ] Add "Start Receiving" action on ASN detail page
- [ ] Update ASN status when receiving starts/completes

### 5.7 Testing & Validation
- [ ] Test receiving with ASN
- [ ] Test receiving without ASN
- [ ] Test discrepancy handling
- [ ] Verify inventory updates on complete
- [ ] Verify transaction audit trail

---

## Module 6: Fulfillment (Pick/Pack/Ship)

> **Goal**: Process outbound orders with task-based workflow

### 6.1 Database Schema
**File**: `packages/database/prisma/schema.prisma`

- [ ] Create `FulfillmentTask` model:
  ```
  - id, tenantId
  - orderId (Order ref, optional)
  - orderNumber (for reference)
  - type (TaskType), status (TaskStatus)
  - priority (Int)
  - assignedToId (User ref, optional)
  - startedAt, completedAt
  - notes, metadata (Json)
  - timestamps
  ```
- [ ] Create `FulfillmentItem` model:
  ```
  - id, taskId (FulfillmentTask ref)
  - sku, description
  - quantity, pickedQty (default 0)
  - fromLocationId, toLocationId (WarehouseLocation refs)
  - notes
  ```
- [ ] Add `fulfillmentTasks` relation to Order model
- [ ] Generate migration

### 6.2 API Routes
**Path**: `apps/web/app/api/warehouse/fulfillment/`

- [ ] `tasks/route.ts` - GET (list tasks), POST (create)
- [ ] `tasks/[id]/route.ts` - GET, PATCH, DELETE
- [ ] `tasks/[id]/assign/route.ts` - POST (assign to user)
- [ ] `tasks/[id]/start/route.ts` - POST (start task)
- [ ] `tasks/[id]/items/[itemId]/route.ts` - PATCH (update picked qty)
- [ ] `tasks/[id]/complete/route.ts` - POST (complete task)
- [ ] `generate/route.ts` - POST (generate tasks from order)
- [ ] `queue/route.ts` - GET (task queue for assignment)

### 6.3 Fulfillment Service
**File**: `apps/web/lib/services/fulfillment.ts`

- [ ] `generateTasksFromOrder(orderId)` - Create pick/pack/ship tasks
- [ ] `assignTask(taskId, userId)` - Assign task
- [ ] `startTask(taskId)` - Start and reserve inventory
- [ ] `completeTask(taskId)` - Complete and update inventory
- [ ] `getNextTask(userId, type)` - Get next task from queue

### 6.4 Admin UI
**Path**: `apps/web/app/(warehouse)/warehouse/fulfillment/`

- [ ] `page.tsx` - Fulfillment dashboard
  - Task queue by type (Pick, Pack, Ship)
  - My tasks (assigned to current user)
  - Metrics: Open tasks, completed today
- [ ] `tasks/page.tsx` - All tasks list
  - DataTable: Order#, Type, Status, Assignee, Priority, Created
  - Filters: Type, Status, Assignee, Date
  - Bulk assign action
- [ ] `tasks/[id]/page.tsx` - Task execution
  - Task header: Order info, type, status
  - Pick: Item list with locations, scan verification
  - Pack: Packaging selection, dimensions, weight
  - Ship: Carrier/service, generate label
  - Complete button

### 6.5 Components
**Path**: `apps/web/components/warehouse/fulfillment/`

- [ ] `TaskQueue.tsx` - Task queue view (Kanban or list)
- [ ] `TaskCard.tsx` - Task summary card
- [ ] `PickList.tsx` - Pick list with locations and quantities
- [ ] `PackStation.tsx` - Pack interface with box selection
- [ ] `ShipStation.tsx` - Ship interface with carrier selection
- [ ] `TaskAssignment.tsx` - Assign task to user
- [ ] `TaskTimer.tsx` - Time tracking display

### 6.6 Integration with Orders
- [ ] Add "Generate Fulfillment" action on Order detail
- [ ] Show fulfillment status on Order list/detail
- [ ] Link to shipping label generation

### 6.7 Testing & Validation
- [ ] Test task generation from order
- [ ] Test pick workflow with inventory reservation
- [ ] Test pack workflow
- [ ] Test complete updates inventory
- [ ] Verify stock decremented on ship

---

## Module 7: Portal (Vendor & Customer Views)

> **Goal**: External user access for ASN submission and inventory visibility

### 7.1 Portal Navigation Update
**File**: `apps/web/app/portal/` layout or navigation

- [ ] Add "Warehouse" section to portal navigation
- [ ] Role-based visibility (vendor vs customer)

### 7.2 Vendor ASN Portal
**Path**: `apps/web/app/portal/warehouse/asn/`

- [ ] `page.tsx` - Vendor's ASN list
  - Only shows ASNs created by this vendor
  - Status, expected date, tracking
- [ ] `new/page.tsx` - Submit new ASN
  - Simplified form for vendors
  - Item entry (SKU, qty, description)
  - File upload option
- [ ] `[id]/page.tsx` - ASN detail (read-only)
  - Status tracking
  - Receiving progress

### 7.3 Customer Inventory Portal
**Path**: `apps/web/app/portal/warehouse/inventory/`

- [ ] `page.tsx` - Available stock view
  - Limited to customer's allocated inventory
  - Available quantities only
  - No location details (just totals)

### 7.4 Portal API Routes
**Path**: `apps/web/app/api/portal/warehouse/`

- [ ] `asn/route.ts` - GET (vendor's ASNs), POST (submit ASN)
- [ ] `asn/[id]/route.ts` - GET (ASN detail)
- [ ] `inventory/route.ts` - GET (customer's available stock)

### 7.5 Components
**Path**: `apps/web/components/portal/warehouse/`

- [ ] `VendorASNForm.tsx` - Simplified ASN form
- [ ] `VendorASNList.tsx` - Vendor's ASN list
- [ ] `CustomerInventory.tsx` - Stock visibility for customers

### 7.6 Notifications
- [ ] Email notification when ASN is received
- [ ] Email notification for low stock (customer)

### 7.7 Testing & Validation
- [ ] Test vendor ASN submission
- [ ] Test portal isolation (vendor sees only their ASNs)
- [ ] Test customer inventory visibility
- [ ] Verify role-based access

---

## Module 8: Background Jobs & Automation

> **Goal**: Automated processing, notifications, and integrations

### 8.1 Queue Definitions
**File**: `apps/web/lib/queue/warehouse-queue.ts`

- [ ] `asn-import-queue` - Process ASN file imports
- [ ] `inventory-sync-queue` - Sync with external systems
- [ ] `low-stock-alert-queue` - Check thresholds, send alerts
- [ ] `fulfillment-auto-assign-queue` - Auto-assign tasks
- [ ] `receiving-reminder-queue` - Remind about pending ASNs

### 8.2 Worker Jobs
**Path**: `apps/worker/jobs/warehouse/`

- [ ] `asn-import.ts` - Parse ASN files (CSV, EDI 856)
- [ ] `inventory-sync.ts` - Sync with PACE or external WMS
- [ ] `low-stock-alerts.ts` - Check thresholds, queue notifications
- [ ] `fulfillment-assignment.ts` - Auto-assign based on rules
- [ ] `receiving-reminder.ts` - Send reminders for arrived ASNs

### 8.3 Scheduled Jobs
- [ ] Daily low stock check
- [ ] Weekly inventory summary report
- [ ] Pending ASN reminder (daily)

### 8.4 Notifications
- [ ] Email templates for warehouse events
- [ ] In-app notification system (optional)
- [ ] Webhook support for integrations

### 8.5 Integrations
- [ ] PACE inventory sync
- [ ] ShipStation label generation link
- [ ] NetSuite inventory value sync

### 8.6 Testing & Validation
- [ ] Test job processing
- [ ] Test notification delivery
- [ ] Test scheduled job execution

---

## Key Files Reference (by module)

### Foundation (Module 0)
- `packages/database/prisma/schema.prisma` - Enums
- `packages/types/src/warehouse.ts` - Types
- `apps/web/components/DynamicSidebar.tsx` - Main Suite navigation (links to Warehouse)
- `apps/web/components/warehouse/WarehouseSidebar.tsx` - Warehouse-specific sidebar
- `apps/web/components/warehouse/WarehouseLayoutClient.tsx` - Warehouse layout wrapper
- `apps/web/app/(warehouse)/layout.tsx` - Warehouse route group layout

### Per Module Pattern
Each module follows this structure:
```
packages/database/prisma/schema.prisma         # Models
apps/web/app/api/warehouse/{module}/           # API routes
apps/web/app/(warehouse)/warehouse/{module}/   # Admin UI (separate route group!)
apps/web/components/warehouse/{module}/        # Components
apps/web/lib/services/{module}.ts              # Business logic
```

> **Note**: Warehouse UI is under `(warehouse)` route group, NOT `(dashboard)`, to enable the separate visual identity.

---

## Session Notes

Use this section to track notes between sessions:

### Session 1 (2025-12-10)
- Initial planning completed
- Codebase analysis done
- Architecture designed
- Plan organized by module for incremental delivery
- **Module 0 Completed:**
  - Added 6 warehouse enums to Prisma schema (LocationType, InventoryTransactionType, ASNStatus, ReceivingStatus, FulfillmentTaskType, FulfillmentTaskStatus)
  - Created `packages/types/src/warehouse.ts` with Zod schemas and TypeScript types
  - Updated `DynamicSidebar.tsx` with Warehouse menu (6 submenu items)
  - Created warehouse dashboard landing page at `/warehouse`
  - Ran `prisma db push` to sync schema

### Session 2 (2025-12-10)
- **Major Architecture Change**: Warehouse UI moved to separate route group
  - Created `apps/web/app/(warehouse)/` route group (separate from `(dashboard)`)
  - This gives Warehouse its own layout, visual identity, and sidebar
  - Warehouse feels like a "separate app" while sharing codebase
- **New Components Created:**
  - `apps/web/components/warehouse/WarehouseSidebar.tsx` - Emerald-themed sidebar
  - `apps/web/components/warehouse/WarehouseLayoutClient.tsx` - Client layout wrapper
  - `apps/web/app/(warehouse)/layout.tsx` - Server layout with auth
  - `apps/web/app/(warehouse)/warehouse/page.tsx` - Dashboard page
- **Visual Identity:**
  - Emerald/teal color scheme (vs blue for main Suite)
  - "Back to Suite" link in sidebar header
  - Pin/unpin sidebar functionality
- **Deleted:**
  - Removed old `apps/web/app/(dashboard)/warehouse/` folder
- **Database Strategy Confirmed:**
  - Using `prisma db push` instead of migrations for all schema changes

### Session 3 (2025-12-10)
- **Module 1 (Locations) Completed:**
  - Created `WarehouseLocation` model in Prisma schema with full relation to Warehouse and Tenant
  - API routes: `GET/POST /api/warehouse/locations`, `GET/PATCH/DELETE /api/warehouse/locations/[id]`, `POST /api/warehouse/locations/bulk`
  - List page with filtering (warehouse, zone, type, status, search) and pagination
  - Create/Edit form with auto-generated barcode from location parts
  - Bulk create wizard with pattern-based generation (zone/aisle/rack/shelf/bin ranges)
  - Ran `prisma db push` to sync new model

### Session 4 (2025-12-10)
- **Module 2 (Inventory Items) Completed:**
  - Created `InventoryItem` model with sku, upc, name, description, category, weight, dimensions
  - API routes: `GET/POST /api/warehouse/items`, `GET/PATCH/DELETE /api/warehouse/items/[id]`
  - List page with search and category filtering
  - Create/Edit form with dimensions support
  - `InventoryItemForm.tsx` component

- **Module 3 (Inventory Stock) Completed:**
  - Created `InventoryStock` model with itemId, locationId, available, reserved, damaged, onHold, lotNumber
  - Created `InventoryTransaction` model for audit trail
  - Inventory service (`apps/web/lib/services/inventory.ts`) with:
    - `adjustStock()` - Create adjustments with transaction logging
    - `transferStock()` - Move between locations atomically
    - `reserveStock()` / `releaseReservation()` - Order reservation support
  - API routes for inventory, adjust, transfer, transactions
  - UI pages: inventory overview, item detail, adjust, transfer, transactions
  - Fixed `findUnique` to `findFirst` for nullable lotNumber in compound keys
  - Added enum exports to `@repo/database`

- **Module 4 (ASN) Completed:**
  - Created `ASN` model with asnNumber, vendorName, warehouseId, expectedDate, carrier, status
  - Created `ASNItem` model with itemId, sku, description, expectedQty, receivedQty
  - Status workflow with valid transitions (DRAFT → PENDING → IN_TRANSIT → ARRIVED → RECEIVING → RECEIVED)
  - API routes: ASN CRUD, items management, status updates, ASN number generation
  - UI pages: ASN list with filters, create form with line items, detail with status timeline
  - Fixed warehouse dropdown (endpoint was `/api/warehouse/warehouses` should be `/api/warehouses`)

### Session 5 (2025-12-11)
- **Module 5 (Receiving) Completed:**
  - Created `ReceivingRecord` model with asnId (unique 1:1 with ASN), warehouseId, receivedById, status
  - Created `ReceivingItem` model with expectedQty, receivedQty, damagedQty, putAwayLocationId, lotNumber
  - Added ReceivingStatus enum export to `@repo/database`
  - Receiving service (`apps/web/lib/services/receiving.ts`) with:
    - `startReceiving()` - Create session from ASN or standalone
    - `recordItem()` - Add/update received items
    - `completeReceiving()` - Complete session, update inventory stock, create transactions
  - API routes: CRUD, items management, complete receiving, start from ASN
  - UI pages: Receiving dashboard (pending ASNs, active sessions), new session, session detail with item entry
  - ASN integration: "Start Receiving" button on ASN detail page, status auto-updates
  - Inventory updates on completion: Creates stock records, logs RECEIVE/DAMAGE transactions

---

## Recommended Implementation Order

```
Module 0 (Foundation)
    ↓
Module 1 (Locations) ──→ Module 2 (Items)
    ↓                        ↓
    └────────→ Module 3 (Stock) ←───────┘
                    ↓
         ┌──────────┴──────────┐
         ↓                     ↓
    Module 4 (ASN)      Module 6 (Fulfillment)
         ↓
    Module 5 (Receiving)
         ↓
    Module 7 (Portal)
         ↓
    Module 8 (Background Jobs)
```

---

*Last updated: 2025-12-11 (Session 5)*
