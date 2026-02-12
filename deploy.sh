#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ID="facturatie-b64d9"
REGION="europe-west1"
SERVICE_NAME="facturatie-api"

echo "=== Stap 1: Backend deployen naar Cloud Run ==="
cd "$ROOT_DIR/backend"

gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --memory 512Mi \
  --set-env-vars "FIREBASE_PROJECT_ID=$PROJECT_ID,FIREBASE_STORAGE_BUCKET=$PROJECT_ID.firebasestorage.app,CORS_ORIGINS=https://facturatie.opwolken.com,FROM_EMAIL=info@opwolken.com" \
  --set-secrets "FIREBASE_CREDENTIALS_JSON=firebase-credentials:latest,RESEND_API_KEY=resend-api-key:latest,GEMINI_API_KEY=gemini-api-key:latest"

echo ""
echo "=== Cloud Run URL ophalen ==="
BACKEND_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format "value(status.url)")

echo "Backend URL: $BACKEND_URL"

echo ""
echo "=== Stap 2: Frontend deployen naar Firebase Hosting ==="
cd "$ROOT_DIR"

export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
NEXT_PUBLIC_API_URL="${BACKEND_URL}/api" firebase deploy --only hosting --project $PROJECT_ID

echo ""
echo "=== Klaar! ==="
echo "Backend: $BACKEND_URL"
echo "Frontend: https://$PROJECT_ID.web.app"
echo ""
echo "Vergeet niet het custom domein in te stellen: Firebase Console → Hosting → Add custom domain"
