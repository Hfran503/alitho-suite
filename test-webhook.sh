#!/bin/bash

# Test ShipStation Webhook
# This sends a sample tracking update to test the webhook endpoint

# Load environment variables
source .env

# Use one of your actual tracking numbers
TRACKING_NUMBER="1Z9634841399247181"

# Use Basic Auth credentials from .env
curl -X POST https://calithosuite.com/api/webhooks/shipstation/track \
  -u "${SHIPSTATION_WEBHOOK_USERNAME}:${SHIPSTATION_WEBHOOK_PASSWORD}" \
  -H "Content-Type: application/json" \
  -H "User-Agent: ShipEngine/v1" \
  -d '{
  "resource_url": "https://api.shipengine.com/v1/tracking?carrier_code=ups&tracking_number='${TRACKING_NUMBER}'",
  "resource_type": "API_TRACK",
  "data": {
    "label_url": null,
    "tracking_number": "'${TRACKING_NUMBER}'",
    "status_code": "IT",
    "carrier_detail_code": null,
    "status_description": "In Transit",
    "carrier_status_code": "IT",
    "carrier_status_description": "Your package is moving within the UPS network and is on track to be delivered",
    "ship_date": "2025-10-22T16:09:00",
    "estimated_delivery_date": "2025-10-23T00:00:00",
    "actual_delivery_date": null,
    "exception_description": null,
    "events": [
      {
        "occurred_at": "2025-10-22T20:00:00Z",
        "carrier_occurred_at": "2025-10-22T16:00:00",
        "description": "In Transit",
        "city_locality": "Oakland",
        "state_province": "CA",
        "postal_code": "94602",
        "country_code": "US",
        "company_name": "",
        "signer": "",
        "event_code": "IT",
        "event_description": "In Transit",
        "carrier_detail_code": null,
        "status_code": null,
        "latitude": 37.8044,
        "longitude": -122.2712
      }
    ]
  }
}'

echo ""
echo "✅ Test webhook sent! Check your shipment tracking page and refresh to see the update."
