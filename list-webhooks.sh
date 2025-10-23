#!/bin/bash

# ShipStation Webhook Verification Script
# Lists all registered webhooks in your ShipStation account

# Load environment variables
source .env

# Check if ShipStation API key is set
if [ -z "$SHIPSTATION_API_KEY" ]; then
  echo "❌ Error: SHIPSTATION_API_KEY not found in .env file"
  echo "Please add your ShipStation API key to .env:"
  echo "SHIPSTATION_API_KEY=your_api_key_here"
  exit 1
fi

echo "🔍 Fetching registered webhooks from ShipStation..."
echo ""

# Get all webhooks
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET https://api.shipengine.com/v1/environment/webhooks \
  -H "API-Key: ${SHIPSTATION_API_KEY}")

# Extract HTTP status code and body
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "✅ Successfully retrieved webhooks:"
  echo ""
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  echo ""

  # Check if our tracking webhook is registered
  if echo "$BODY" | grep -q "calithosuite.com/api/webhooks/shipstation/track"; then
    echo "✅ Tracking webhook is registered!"
  else
    echo "⚠️  Tracking webhook NOT found. Run ./register-webhook.sh to register it."
  fi
else
  echo "❌ Failed to retrieve webhooks (HTTP $HTTP_CODE)"
  echo ""
  echo "Response:"
  echo "$BODY"
fi
