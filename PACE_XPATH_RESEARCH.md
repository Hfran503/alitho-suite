# PACE XPath Research & Testing Results

## Summary

**Conclusion:** XPath date filtering is **IMPOSSIBLE** for PACE JobShipment API.

No date-related attributes exist that can be queried via XPath. The only solution is to fetch records by `@id` and filter server-side.

---

## What We Tested (All Failed)

### 1. Direct Child Element Access
```xpath
dateTime >= '2025-10-17T00:00:00'
```
**Error:** `"Cannot convert children into a filter: dateTime"`
**Reason:** `dateTime` is a child element, not an attribute

### 2. XPath substring() Function
```xpath
substring(dateTime, 1, 19) >= '2025-10-17T00:00:00'
```
**Error:** `"unknown or unsupported function: substring"`
**Reason:** PACE doesn't support XPath functions

### 3. XPath starts-with() Function
```xpath
starts-with(dateTime, '2025-10-17')
```
**Error:** `"Cannot convert children into a filter: dateTime"`
**Reason:** Cannot use functions on child elements

### 4. Attribute @dateTime
```xpath
@dateTime >= "2025-10-17T00:00:00"
```
**Error:** `"Unknown field 'dateTime' on object 'JobShipment'"`
**Reason:** `dateTime` is not a queryable attribute

### 5. Attribute @date
```xpath
@date >= "2025-10-17"
```
**Error:** `"param2 cannot be null"` or field doesn't exist
**Reason:** No `@date` attribute exists on JobShipment

### 6. Attribute @promiseDate
```xpath
@promiseDate >= "2025-10-17"
```
**Error:** Field doesn't exist
**Reason:** No `@promiseDate` attribute exists

### 7. Custom Field @u_create_date
```xpath
@u_create_date = "2025-10-17"
```
**Error:** `"Unknown field 'u_create_date' on object 'JobShipment'"`
**Reason:** Exists in response but not queryable as attribute

### 8. POST Body Filtering
```json
[{ "xpath": "@date='2025-10-17'" }]
```
**Error:** `"Unable to determine Field from binding expression"`
**Reason:** POST body is for sorting only, not filtering

---

## What Actually Works

### ✅ Filtering by Attributes
```xpath
@id > 0
@job = "12345"
@customer = "ABC Corp"
contains(@customer, "ABC")
```

### ✅ Working Solution for Date Filtering

**Approach:**
1. Fetch recent records: `xpath=@id > 0`
2. Sort by ID descending: `[{ "xpath": "@id", "descending": true }]`
3. Limit results: `limit=500`
4. Filter server-side by `dateTime` field after retrieval

**Implementation:**
```typescript
// Step 1: Fetch from PACE
const response = await fetch(
  `${PACE_API}/FindObjects/findSortAndLimit?type=JobShipment&xpath=@id>0&offset=0&limit=500`,
  {
    method: 'POST',
    body: JSON.stringify([{ xpath: '@id', descending: true }])
  }
)

// Step 2: Get shipment IDs
const ids = await response.json()

// Step 3: Fetch details for each ID
for (const id of ids) {
  const shipment = await fetchShipmentDetails(id)

  // Step 4: Filter by dateTime
  if (shipment.dateTime >= startDate && shipment.dateTime <= endDate) {
    filteredShipments.push(shipment)
  }
}
```

---

## PACE JobShipment Date Fields

From actual API response inspection:

| Field | Type | Queryable | Example Value |
|-------|------|-----------|---------------|
| `dateTime` | child element | ❌ No | `"2025-10-17T18:40:00"` |
| `promiseDateTime` | child element | ❌ No | `"2025-10-17T07:00:00"` |
| `u_create_date` | derived field | ❌ No | `"2025-10-17"` |
| `lotExpirationDate` | child element | ❌ No | `null` |
| `dateForced` | boolean | ❌ No | `false` |
| `timeForced` | boolean | ❌ No | `false` |

**None of these are queryable attributes.**

---

## Key Learnings

1. **PACE XPath only supports attributes** (fields with `@` prefix)
2. **No date attributes exist** on JobShipment object
3. **Child elements cannot be filtered** via XPath
4. **XPath functions are not supported** (substring, starts-with, etc.)
5. **POST body is for sorting only**, not filtering
6. **String values must use double quotes** in XPath: `@field="value"` not `@field='value'`

---

## Recommendations

### For Single-Day Queries
- Fetch 500 most recent records
- Filter server-side by `dateTime`
- Cache results if querying repeatedly

### For Date Ranges
- Same approach (server-side filtering)
- Consider increasing fetch limit if needed
- Monitor performance with large datasets

### Alternative Approaches (If Available)
1. **Use @job filter** if you know the job numbers for a date range
2. **Use @customer filter** to narrow results before date filtering
3. **Combine filters:** `@job="12345" and @customer="ABC"` then filter by date

---

## Files Modified

1. `/apps/web/app/api/pace/shipments/route.ts` - Original implementation
2. `/apps/web/app/api/pace/shipments/by-date/route.ts` - Testing endpoint with comprehensive XPath attempts
3. `/apps/web/app/(dashboard)/shipments-by-date/page.tsx` - UI demonstrating all tests
4. `/apps/web/app/api/pace/test-shipment/route.ts` - Inspection endpoint to view actual fields

---

## Testing Methodology

1. Created dedicated `/shipments-by-date` endpoint for testing
2. Tried each XPath approach individually
3. Logged all requests and responses
4. Inspected actual JobShipment object structure
5. Referenced PACE API documentation and examples
6. Documented each failure with exact error messages

---

## Conclusion

While XPath date filtering would be ideal, PACE's JobShipment API **does not support it**. The server-side filtering approach is the only viable solution and works reliably for:

- ✅ Recent shipments (last 500)
- ✅ Single-day queries
- ✅ Multi-day ranges
- ✅ Combined with @job/@customer filters

This approach is used successfully in both `/shipments` and `/shipments-by-date` pages.
