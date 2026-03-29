#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ID="facturatie-b64d9"
REGION="europe-west1"
SERVICE_NAME="facturatie-api"

export PATH="/opt/homebrew/opt/node@22/bin:$PATH"

DEPLOY_TARGET="${1:-full}"

deploy_backend() {
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
}

build_frontend() {
  echo ""
  echo "=== Stap 2: Frontend statisch bouwen ==="
  cd "$ROOT_DIR/frontend"
  npm run build
}

deploy_hosting() {
  echo ""
  echo "=== Stap 3: Firebase Hosting deployen ==="
  cd "$ROOT_DIR"
  firebase deploy --only hosting --project $PROJECT_ID
}

case "$DEPLOY_TARGET" in
  backend)
    deploy_backend
    ;;
  frontend)
    build_frontend
    deploy_hosting
    ;;
  full)
    deploy_backend
    build_frontend
    deploy_hosting
    ;;
  *)
    echo "Gebruik: ./deploy.sh [full|frontend|backend]"
    exit 1
    ;;
esac

echo ""
echo "=== Klaar! ==="
echo "Backend service: $SERVICE_NAME"
echo "Frontend: https://$PROJECT_ID.web.app"
echo "          https://facturatie.opwolken.com"
