# PACE API Quick Reference

This document provides a quick reference for working with the PACE API integration in the Alitho Suite.

## Configuration

### Environment Variables (.env)
```bash
PACE_API_URL=http://192.168.1.218/rpc/rest/services
PACE_USERNAME=your-username
PACE_PASSWORD=your-password
```

## API Endpoints

### Base URL Structure
```
http://[PACE_SERVER]/rpc/rest/services/[SERVICE]/[METHOD]
```

### Authentication
All requests use **Basic Authentication**:
```javascript
Authorization: Basic base64(username:password)
```

## Job Shipments

### 1. Search for Shipments (FindObjects)

**Endpoint:**
```
POST /FindObjects/findSortAndLimit
```

**Query Parameters:**
```
type=JobShipment
xpath=[XPath query]
offset=[pagination offset]
limit=[results per page]
```

**Request Body (Sorting):**
```json
[
  {
    "xpath": "dateTime",
    "ascending": false
  }
]
```

**Response:**
```json
["138953", "138954", "138955"]
```

### 2. Get Shipment Details (ReadObject)

**Endpoint:**
```
POST /ReadObject/readJobShipment?primaryKey={id}
```

**Request Body:**
```
(empty string)
```

**Response:**
```json
{
  "id": 138953,
  "job": "12345",
  "jobPart": "1",
  "customer": "ABC Corporation",
  "dateTime": "2025-01-15T10:30:00.000Z",
  "quantity": 1000,
  "trackingNumber": "1Z999AA1234567890",
  "contactFirstName": "John",
  "contactLastName": "Doe",
  "address1": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zip": "10001",
  ...
}
```

## XPath Query Examples

### Date Filtering

**Today's shipments:**
```xpath
dateTime >= '2025-01-15T00:00:00.000Z' and dateTime <= '2025-01-15T23:59:59.999Z'
```

**Date range:**
```xpath
dateTime >= '2025-01-01T00:00:00.000Z' and dateTime <= '2025-01-31T23:59:59.999Z'
```

**After a specific date:**
```xpath
dateTime >= '2025-01-01T00:00:00.000Z'
```

### Combined Filters

**Date + Job number:**
```xpath
dateTime >= '2025-01-01T00:00:00.000Z' and job = '12345'
```

**Date + Customer (partial match):**
```xpath
dateTime >= '2025-01-01T00:00:00.000Z' and contains(customer, 'ABC')
```

**Multiple conditions:**
```xpath
dateTime >= '2025-01-01T00:00:00.000Z' and dateTime <= '2025-01-31T23:59:59.999Z' and job = '12345' and contains(customer, 'ABC')
```

### Special Queries

**All shipments:**
```xpath
id > 0
```

**Shipments with tracking number:**
```xpath
trackingNumber != ''
```

**Specific customer:**
```xpath
customer = 'ABC Corporation'
```

## XPath Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `=` | Equals | `job = '12345'` |
| `!=` | Not equals | `trackingNumber != ''` |
| `>` | Greater than | `quantity > 100` |
| `<` | Less than | `quantity < 1000` |
| `>=` | Greater or equal | `dateTime >= '2025-01-01'` |
| `<=` | Less or equal | `dateTime <= '2025-12-31'` |
| `and` | Logical AND | `job = '12345' and customer = 'ABC'` |
| `or` | Logical OR | `customer = 'ABC' or customer = 'XYZ'` |
| `contains()` | Substring match | `contains(customer, 'Corp')` |

## Curl Examples

### Search for shipments by date
```bash
curl -X POST \
  'http://192.168.1.218/rpc/rest/services/FindObjects/findSortAndLimit?type=JobShipment&xpath=dateTime%20%3E%3D%20%272025-01-01T00%3A00%3A00.000Z%27&offset=0&limit=20' \
  -H 'Accept: application/json' \
  -H 'Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=' \
  -H 'Content-Type: application/json' \
  -d '[{"xpath":"dateTime","ascending":false}]'
```

### Get shipment details
```bash
curl -X POST \
  'http://192.168.1.218/rpc/rest/services/ReadObject/readJobShipment?primaryKey=138953' \
  -H 'Accept: application/json' \
  -H 'Authorization: Basic dXNlcm5hbWU6cGFzc3dvcmQ=' \
  -d ''
```

## Node.js/TypeScript Example

```typescript
// Search for shipments
const searchResponse = await fetch(
  `${PACE_API_URL}/FindObjects/findSortAndLimit?type=JobShipment&xpath=${encodeURIComponent(xpathQuery)}&offset=0&limit=20`,
  {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ xpath: 'dateTime', ascending: false }]),
  }
)

const shipmentIds = await searchResponse.json()

// Get details for each shipment
for (const id of shipmentIds) {
  const detailResponse = await fetch(
    `${PACE_API_URL}/ReadObject/readJobShipment?primaryKey=${id}`,
    {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      },
      body: '',
    }
  )

  const shipment = await detailResponse.json()
  console.log(shipment)
}
```

## Common JobShipment Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Primary key |
| `job` | string | Job number |
| `jobPart` | string | Job part identifier |
| `jobPartKey` | string | Job part key |
| `customer` | string | Customer name |
| `dateTime` | string (ISO) | Shipment date/time |
| `quantity` | number | Quantity shipped |
| `quantityRemaining` | number | Remaining quantity |
| `trackingNumber` | string | Tracking number |
| `shipVia` | number | Shipping method ID |
| `shipViaNote` | string | Shipping notes |
| `contactFirstName` | string | Contact first name |
| `contactLastName` | string | Contact last name |
| `address1` | string | Street address |
| `address2` | string | Address line 2 |
| `city` | string | City |
| `state` | string | State/Province |
| `zip` | string | Postal code |
| `country` | number | Country ID |
| `phone` | string | Phone number |
| `email` | string | Email address |
| `weight` | number | Package weight |
| `cost` | number | Shipping cost |
| `quotedPrice` | number | Quoted price |
| `description` | string | Description |
| `notes` | string | Additional notes |

## Pagination

**Calculate offset:**
```javascript
const offset = (page - 1) * pageSize
```

**Example:**
- Page 1, Size 20: offset = 0, limit = 20
- Page 2, Size 20: offset = 20, limit = 20
- Page 3, Size 20: offset = 40, limit = 20

## Error Handling

Common HTTP status codes:
- `200` - Success
- `401` - Unauthorized (check credentials)
- `404` - Not found (check URL/primaryKey)
- `500` - Server error (check PACE logs)

## Best Practices

1. **Always use date filters** to limit result set
2. **Batch read operations** when fetching multiple shipments
3. **Cache results** when appropriate to reduce API calls
4. **Handle errors gracefully** with retry logic
5. **URL encode XPath queries** to prevent parsing errors
6. **Sort by dateTime descending** for most recent shipments first
7. **Use pagination** for large result sets
8. **Escape special characters** in XPath string values

## Testing

### Test connection:
```bash
curl -X POST \
  'http://192.168.1.218/rpc/rest/services/FindObjects/findSortAndLimit?type=JobShipment&xpath=id%20%3E%200&offset=0&limit=1' \
  -H 'Accept: application/json' \
  -H 'Authorization: Basic [your-base64-credentials]' \
  -d '[]'
```

### Verify credentials:
If you get a 401 error, check your Base64 encoding:
```bash
echo -n "username:password" | base64
```

## Additional Resources

- PACE Swagger documentation: `/PACE_swagger.json`
- Setup guide: `/SHIPMENTS_SETUP.md`
- Implementation: `/apps/web/app/api/pace/shipments/route.ts`
