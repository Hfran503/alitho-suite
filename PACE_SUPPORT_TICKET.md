# PACE API Support Ticket: XPath Date Filtering for JobShipment

---

## Subject
How to filter JobShipment records by date using XPath in FindObjects/findSortAndLimit API?

---

## Environment
- **PACE API Version:** [Your version]
- **API Endpoint:** `/FindObjects/findSortAndLimit`
- **Object Type:** `JobShipment`
- **Integration Method:** REST API

---

## Problem Statement

We are attempting to filter JobShipment records by date using the XPath parameter in the `FindObjects/findSortAndLimit` endpoint. Despite extensive testing with various XPath expressions, we consistently receive errors indicating that date fields cannot be used in XPath filters.

**Current workaround:** Fetching 500 records sorted by @id and filtering by dateTime on the client side, which is inefficient for large datasets.

**Question:** What is the correct XPath syntax to filter JobShipment records by date fields?

---

## API Request Details

### Base URL
```
POST http://[PACE_SERVER]/rpc/rest/services/FindObjects/findSortAndLimit
```

### Query Parameters
```
type=JobShipment
xpath=[XPath expression]
offset=0
limit=500
```

### Authentication
```
Authorization: Basic [credentials]
Content-Type: application/json
Accept: application/json
```

---

## What We've Tried (All Failed)

### 1. Child Element Direct Access
**XPath:**
```xpath
dateTime >= '2025-10-17T00:00:00'
```
**Request Body:**
```json
[]
```
**Error Response:**
```json
{"message": "Cannot convert children into a filter: dateTime"}
```

---

### 2. XPath substring() Function
**XPath:**
```xpath
substring(dateTime, 1, 19) >= '2025-10-17T00:00:00'
```
**Request Body:**
```json
[]
```
**Error Response:**
```json
{"message": "unknown or unsupported function: substring"}
```

---

### 3. XPath starts-with() Function
**XPath:**
```xpath
starts-with(dateTime, '2025-10-17')
```
**Request Body:**
```json
[]
```
**Error Response:**
```json
{"message": "Cannot convert children into a filter: dateTime"}
```

---

### 4. Attribute @dateTime (with proper syntax)
**XPath:**
```xpath
@dateTime>="2025-10-17T00:00:00" and @dateTime<"2025-10-18T00:00:00"
```
**Request Body:**
```json
[]
```
**Error Response:**
```json
{"message": "Unknown field 'dateTime' on object 'JobShipment'"}
```

---

### 5. Alternative Date Attributes
We also tested:
- `@date` - Field doesn't exist
- `@promiseDate` - Field doesn't exist
- `@u_create_date` - Unknown field error

All resulted in "Unknown field" or "param2 cannot be null" errors.

---

### 6. POST Body Filtering Attempt
**URL XPath:**
```xpath
@id > 0
```
**Request Body (attempting to filter):**
```json
[{"xpath": "@date='2025-10-17'"}]
```
**Error Response:**
```json
{"message": "Unable to determine Field from binding expression"}
```

---

## What Currently Works

### ✅ Non-Date Attribute Filtering
These XPath expressions work successfully:

```xpath
@job = "12345"
@customer = "ABC Corporation"
contains(@customer, "ABC")
@id > 0
```

### ✅ Sorting (Request Body)
```json
[{"xpath": "@id", "descending": true}]
```

---

## Actual JobShipment Response Data

When we read a JobShipment object, we see these date-related fields in the response:

```json
{
  "id": 139064,
  "dateTime": "2025-10-17T18:40:00",
  "promiseDateTime": "2025-10-17T07:00:00",
  "u_create_date": "2025-10-17",
  "lotExpirationDate": null,
  "dateForced": false,
  "timeForced": false,
  ...
}
```

However, **none of these fields are queryable** via XPath according to our testing.

---

## Questions for PACE Support

1. **Does JobShipment support date filtering via XPath?**
   - If yes, what is the correct field name and syntax?
   - If no, what is the recommended approach for date-based queries?

2. **What date-related attributes exist on JobShipment that can be used in XPath?**
   - Is there an attribute we're missing (e.g., `@shipDate`, `@createdDate`)?

3. **What XPath functions are supported?**
   - Can we use date functions like `substring()`, `starts-with()`, or date comparisons?

4. **Is there a way to filter by date ranges efficiently?**
   - Without fetching all records and filtering client-side?

5. **Can you provide a working example?**
   - An XPath query that filters JobShipment records by date (e.g., all shipments on 2025-10-17)

---

## Use Case

We need to retrieve shipments for specific dates/date ranges for:
- Daily shipping reports
- Date-specific dashboards
- Historical shipment lookups
- Integration with external systems

Currently, we must:
1. Fetch 500 most recent records (`xpath=@id>0`, sorted by `@id` descending)
2. Read each shipment's full details
3. Filter by `dateTime` on our application server

This is inefficient and doesn't scale well for:
- Older date ranges (may not be in the 500 most recent)
- High-volume operations
- Real-time queries

---

## Expected Solution

Ideally, we would like to:

```bash
# Example: Get all shipments on a specific date
curl -X POST \
  'http://[SERVER]/rpc/rest/services/FindObjects/findSortAndLimit?type=JobShipment&xpath=[CORRECT_DATE_XPATH]&offset=0&limit=500' \
  -H 'Authorization: Basic [credentials]' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -d '[]'
```

Where `[CORRECT_DATE_XPATH]` filters by date (e.g., 2025-10-17).

---

## Additional Information

- We have successfully integrated other PACE endpoints
- We can filter by `@job` and `@customer` without issues
- We have reviewed available PACE documentation
- We can provide additional details or test cases if needed

---

## Request

Please provide:
1. Confirmation whether date filtering is supported for JobShipment
2. The correct XPath syntax and field names for date filtering
3. A working example request/response
4. Documentation reference if available

Thank you for your assistance!

---

## Contact Information

**Name:** [Your Name]
**Company:** [Your Company]
**Email:** [Your Email]
**Phone:** [Your Phone]
**PACE Customer ID:** [Your Customer ID]

---

## Attachments

1. Full request/response logs (if needed)
2. Code samples demonstrating our testing
3. Screenshots of error messages (if required)

---

**Ticket Priority:** Medium
**Expected Response Time:** Within 2 business days

---

*Generated: 2025-10-17*
