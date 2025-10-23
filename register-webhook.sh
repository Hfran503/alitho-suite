#!/bin/bash

# ShipStation Webhook Registration Script
# This script registers the tracking webhook with ShipStation API

# Load environment variables
source .env

# Check if ShipStation API key is set
if [ -z "$SHIPSTATION_API_KEY" ]; then
  echo "❌ Error: SHIPSTATION_API_KEY not found in .env file"
  echo "Please add your ShipStation API key to .env:"
  echo "SHIPSTATION_API_KEY=your_api_key_here"
  exit 1
fi

# Webhook URL with Basic Auth credentials
WEBHOOK_URL="https://${SHIPSTATION_WEBHOOK_USERNAME}:${SHIPSTATION_WEBHOOK_PASSWORD}@calithosuite.com/api/webhooks/shipstation/track"

echo "🔧 Registering ShipStation tracking webhook..."
echo "📍 Webhook URL: https://${SHIPSTATION_WEBHOOK_USERNAME}:***@calithosuite.com/api/webhooks/shipstation/track"
echo ""

# Register the webhook
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST https://api.shipengine.com/v1/environment/webhooks \
  -H "API-Key: ${SHIPSTATION_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "'"${WEBHOOK_URL}"'",
    "event": "track"
  }')

# Extract HTTP status code and body
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
  echo "✅ Webhook registered successfully!"
  echo ""
  echo "Response:"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""
  echo "🎉 Your webhook is now active and will receive tracking updates!"
else
  echo "❌ Failed to register webhook (HTTP $HTTP_CODE)"
  echo ""
  echo "Response:"
  echo "$BODY"
  echo ""
  echo "💡 Troubleshooting:"
  echo "  - Verify your API key is correct"
  echo "  - Check if webhook already exists (you may need to update instead)"
  echo "  - Ensure your URL is publicly accessible"
fi
