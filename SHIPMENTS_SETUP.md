# Job Shipments Feature - Setup Guide

This guide explains how to set up and use the Job Shipments feature that integrates with the PACE API to display shipments with day-based filtering.

## Overview

The Job Shipments feature allows you to:
- View job shipments from the PACE system
- Filter shipments by date range (with quick filters for today, this week, this month)
- Filter by job number and customer
- Paginate through results
- View detailed shipping information including addresses and tracking numbers

## Files Created

### 1. TypeScript Types
**File:** `packages/types/src/index.ts`

Added `JobShipment` schema and types based on the PACE API swagger definition:
- `jobShipmentSchema` - Zod schema for validation
- `jobShipmentFilterSchema` - Filter parameters schema
- `JobShipment` type
- `JobShipmentFilter` type

### 2. API Route
**File:** `apps/web/app/api/pace/shipments/route.ts`

GET endpoint that:
- Authenticates users via NextAuth
- Validates tenant membership
- Accepts date range filters (startDate, endDate)
- Accepts job and customer filters
- Calls PACE API `/ReadObject/readJobShipment` endpoint
- Returns paginated results

### 3. Frontend Page
**File:** `apps/web/app/(dashboard)/shipments/page.tsx`

React component that provides:
- Date picker inputs for start and end dates
- Quick filter buttons (Today, This Week, This Month)
- Job number and customer text filters
- Responsive data table showing shipment details
- Pagination controls
- Loading and error states

### 4. Navigation
**File:** `apps/web/components/Sidebar.tsx`

Added "Shipments" navigation item to the sidebar menu.

## Setup Instructions

### Step 1: Configure PACE API Credentials

Add the following environment variables to your `.env` file:

```bash
# PACE API Integration
PACE_API_URL=http://192.168.1.218/rpc/rest/services
PACE_USERNAME=your-username
PACE_PASSWORD=your-password
```

**Notes:**
- Replace `http://192.168.1.218` with your actual PACE server IP/hostname
- The path must be `/rpc/rest/services` (do not change this)
- Use Basic Authentication with your PACE username and password
- Contact your PACE administrator for credentials

### Step 2: Update Package Types

The TypeScript types have been added to the shared types package. Rebuild the types:

```bash
pnpm build --filter @repo/types
```

### Step 3: Test the API Endpoint

You can test the API endpoint directly:

```bash
curl -X GET 'http://localhost:3000/api/pace/shipments?startDate=2025-01-01&endDate=2025-01-31' \
  -H 'Cookie: your-session-cookie'
```

### Step 4: Access the Shipments Page

1. Start your development server:
   ```bash
   pnpm dev
   ```

2. Navigate to `/shipments` in your browser

3. Use the date filters to view shipments

## Usage

### Quick Date Filters

The page includes three quick filter buttons:

- **Today**: Sets start and end date to today
- **This Week**: Sets date range to current week (Monday-Sunday)
- **This Month**: Sets date range to current month

### Custom Date Range

Use the date picker inputs to select any custom date range.

### Additional Filters

- **Job Number**: Filter shipments by specific job number
- **Customer**: Filter shipments by customer name

### Pagination

Results are paginated with 20 items per page by default. Use the Previous/Next buttons to navigate.

## Data Displayed

The shipments table shows:

| Column | Description |
|--------|-------------|
| Date/Time | When the shipment was created |
| Job | Job number and part information |
| Customer | Customer name |
| Ship To | Contact name and shipping address |
| Quantity | Number of items shipped |
| Tracking | Tracking number if available |

## API Integration Details

### PACE API Endpoints Used

The implementation uses two PACE API endpoints:

#### 1. FindObjects/findSortAndLimit (Search)
**Purpose:** Find shipment IDs matching criteria

**Endpoint:** `POST /FindObjects/findSortAndLimit`

**Query Parameters:**
- `type`: `"JobShipment"` (required)
- `xpath`: XPath query string (required)
- `offset`: Pagination offset (required)
- `limit`: Number of results (required)

**Request Body:** Sorting parameters
```json
[
  {
    "xpath": "dateTime",
    "ascending": false
  }
]
```

**XPath Query Examples:**
```xpath
// Date range filter
dateTime >= '2025-01-01T00:00:00.000Z' and dateTime <= '2025-01-31T23:59:59.999Z'

// With job number
dateTime >= '2025-01-01T00:00:00.000Z' and job = '12345'

// With customer (partial match)
dateTime >= '2025-01-01T00:00:00.000Z' and contains(customer, 'ABC Corp')

// All shipments
id > 0
```

**Response:** Array of shipment primary keys (IDs)
```json
["138953", "138954", "138955"]
```

#### 2. ReadObject/readJobShipment (Get Details)
**Purpose:** Fetch full shipment details

**Endpoint:** `POST /ReadObject/readJobShipment?primaryKey={id}`

**Request Body:** Empty string `""`

**Response:** Full JobShipment object matching the schema

## Customization

### Change Page Size
Edit the default page size in `apps/web/app/(dashboard)/shipments/page.tsx`:

```typescript
const [pagination, setPagination] = useState({
  page: 1,
  pageSize: 20, // Change this value
  total: 0,
  totalPages: 0,
})
```

### Add More Filters
To add additional filters:

1. Add filter state in the component
2. Add UI input for the filter
3. Update the `fetchShipments` function to include the filter in the API call

### Modify Table Columns
Edit the table in `apps/web/app/(dashboard)/shipments/page.tsx` to show different columns.

## Troubleshooting

### Error: "PACE API not configured"
- Ensure `PACE_API_URL` is set in your `.env` file
- Restart your development server after adding environment variables

### Error: "PACE API credentials not configured"
- Ensure you have both `PACE_USERNAME` and `PACE_PASSWORD` set
- Verify the credentials are correct with your PACE administrator

### Error: "Failed to fetch shipments from PACE API"
- Check that the PACE API URL is correct and accessible
- Verify your PACE API credentials are valid
- Check the browser console and server logs for more details
- Ensure your PACE server is running and accessible from your application

### Error: "System License Expired" (503 Service Unavailable)
- **The PACE system license has expired**
- Contact your PACE administrator or vendor to renew the license
- The API will not work until the license is renewed
- This is a PACE server-side issue, not an application issue

### No shipments displayed
- Verify there are shipments in the selected date range in PACE
- Check that the date filters are set correctly
- Try expanding the date range

### "Unauthorized" error
- Ensure you're logged in to the application
- Check that your session is valid

## Technical Notes

### Date Handling
- Dates are stored in PACE as ISO 8601 datetime strings
- The UI converts local dates to UTC for API queries
- Start date is set to 00:00:00.000
- End date is set to 23:59:59.999

### Authentication Flow
1. User authenticates via NextAuth
2. API validates session and tenant membership
3. API calls PACE with stored credentials
4. Results are filtered by date and returned to client

### Security
- All API calls require valid user session
- PACE credentials are stored server-side only
- Never expose PACE credentials to the client
- Multi-tenant isolation ensures users only see their tenant's data

## Future Enhancements

Potential improvements to consider:

1. **Export functionality** - Export filtered shipments to CSV/Excel
2. **Shipment details modal** - Click to view full shipment details
3. **Real-time updates** - WebSocket integration for live updates
4. **Advanced filters** - Ship via, status, tracking number search
5. **Bulk actions** - Select multiple shipments for batch operations
6. **Charts/Analytics** - Visualize shipment trends over time
7. **Email notifications** - Alert when shipments are created/updated
8. **Mobile responsiveness** - Optimize table for mobile devices

## Support

For issues or questions:
- Check the browser console for client-side errors
- Check server logs for API errors
- Verify PACE API documentation for endpoint details
- Contact your PACE administrator for API access issues
