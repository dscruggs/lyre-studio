#!/bin/bash
set -e

# Lyre Studio Deployment Script
# Usage: ./deploy.sh <environment> [--backend-only | --frontend-only | --proxy-only]

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "Loading environment from .env..."
    export $(grep -v '^#' .env | xargs)
fi

# Check for required HF_TOKEN for backend deployments
check_hf_token() {
    if [ -z "$HF_TOKEN" ]; then
        echo "ERROR: HF_TOKEN is not set."
        echo "Please create a .env file with your Hugging Face token:"
        echo "  cp env.example .env"
        echo "  # Then edit .env and add your token"
        exit 1
    fi
}

if [ -z "$1" ]; then
    echo "Usage: ./deploy.sh <environment> [--backend-only | --frontend-only | --proxy-only]"
    echo "  environment: dev or prod"
    echo "  --backend-only: Only deploy the backend service"
    echo "  --frontend-only: Only deploy frontend (static + proxy)"
    echo "  --proxy-only: Only deploy the API proxy (no static rebuild)"
    exit 1
fi

ENV=$1
OPTION=${2:-""}
REGION="us-central1"

# Configuration
case $ENV in
    dev)
        PROJECT_ID="lyrestudio-dev"
        FIREBASE_PROJECT_ID="lyrestudio-dev"
        HOSTING_URL="https://lyrestudio-dev.web.app"
        ;;
    prod)
        PROJECT_ID="lyrestudio"
        FIREBASE_PROJECT_ID="lyrestudio"
        HOSTING_URL="https://lyrestudio.web.app"
        ;;
    *)
        echo "Unknown environment: $ENV (use 'dev' or 'prod')"
        exit 1
        ;;
esac

BACKEND_SERVICE="lyre-backend"
FRONTEND_SERVICE="lyre-frontend"

echo "========================================"
echo "Deploying Lyre Studio to: $ENV"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "========================================"

# Set the project
gcloud config set project $PROJECT_ID

deploy_backend() {
    echo ""
    echo ">>> Deploying Backend Service (with GPU)..."
    echo ""
    
    # Check for HF_TOKEN (required to download models during build)
    check_hf_token
    
    # Allow requests from Firebase Hosting URL
    ALLOWED_ORIGINS="${HOSTING_URL}"
    IMAGE_URL="gcr.io/${PROJECT_ID}/${BACKEND_SERVICE}"
    
    # Build the container image using cloudbuild.yaml (specifies Dockerfile.backend)
    # Pass HF_TOKEN for model downloads during build
    echo "Building backend container image (this may take 15-20 min first time)..."
    gcloud builds submit --config deploy/cloudbuild.yaml --substitutions=_HF_TOKEN="$HF_TOKEN" .
    
    # Deploy the built image to Cloud Run
    echo "Deploying to Cloud Run..."
    gcloud run deploy $BACKEND_SERVICE \
        --image $IMAGE_URL \
        --region $REGION \
        --gpu 1 \
        --gpu-type nvidia-l4 \
        --memory 16Gi \
        --cpu 4 \
        --concurrency 1 \
        --max-instances 1 \
        --no-gpu-zonal-redundancy \
        --no-cpu-throttling \
        --timeout 300 \
        --no-allow-unauthenticated \
        --set-env-vars "ALLOWED_ORIGINS=${ALLOWED_ORIGINS}"
    
    BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region $REGION --format 'value(status.url)')
    echo "Backend deployed at: $BACKEND_URL"
}

deploy_api_proxy() {
    echo ""
    echo ">>> Deploying API Proxy Service..."
    echo ""
    
    # Get backend URL
    BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region $REGION --format 'value(status.url)' 2>/dev/null || echo "")
    
    if [ -z "$BACKEND_URL" ]; then
        echo "ERROR: Backend not deployed yet. Run without --proxy-only first."
        exit 1
    fi
    
    IMAGE_URL="gcr.io/${PROJECT_ID}/${FRONTEND_SERVICE}"
    
    # Build the container image (Dockerfile is in deploy/frontend/)
    echo "Building API proxy container image..."
    gcloud builds submit --tag $IMAGE_URL deploy/frontend
    
    # Deploy the built image to Cloud Run
    echo "Deploying to Cloud Run..."
    gcloud run deploy $FRONTEND_SERVICE \
        --image $IMAGE_URL \
        --region $REGION \
        --memory 512Mi \
        --cpu 1 \
        --timeout 300 \
        --allow-unauthenticated \
        --set-env-vars "BACKEND_URL=${BACKEND_URL},FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}"
    
    echo "API Proxy deployed!"
}

deploy_static() {
    echo ""
    echo ">>> Building and deploying static files to Firebase Hosting..."
    echo ""
    
    # Build React app
    echo "Building React app..."
    cd src/frontend
    bun install
    bun run build
    cd ../..
    
    # Copy built files to deploy/static/
    echo "Copying build to deploy/static/..."
    rm -rf deploy/static
    cp -r src/frontend/dist deploy/static
    
    # Deploy to Firebase Hosting (from deploy/ folder)
    echo "Deploying to Firebase Hosting..."
    cd deploy
    firebase use $ENV
    firebase deploy --only hosting
    cd ..
    
    echo "Static files deployed to: $HOSTING_URL"
}

deploy_frontend() {
    deploy_api_proxy
    deploy_static
}

setup_service_auth() {
    echo ""
    echo ">>> Setting up service-to-service authentication..."
    echo ""
    
    # Get the frontend service account
    FRONTEND_SA=$(gcloud run services describe $FRONTEND_SERVICE \
        --region $REGION \
        --format='value(spec.template.spec.serviceAccountName)')
    
    if [ -z "$FRONTEND_SA" ]; then
        # Default compute service account
        PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
        FRONTEND_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
    fi
    
    echo "Frontend service account: $FRONTEND_SA"
    
    # Grant the frontend permission to invoke the backend
    gcloud run services add-iam-policy-binding $BACKEND_SERVICE \
        --region $REGION \
        --member="serviceAccount:${FRONTEND_SA}" \
        --role="roles/run.invoker"
    
    echo "Service auth configured!"
}

# Execute based on options
case $OPTION in
    --backend-only)
        deploy_backend
        ;;
    --frontend-only)
        deploy_frontend
        setup_service_auth
        ;;
    --proxy-only)
        deploy_api_proxy
        setup_service_auth
        ;;
    *)
        deploy_backend
        deploy_frontend
        setup_service_auth
        ;;
esac

# Get final URLs
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region $REGION --format 'value(status.url)' 2>/dev/null || echo "Not deployed")

echo ""
echo "========================================"
echo "Deployment Complete!"
echo ""
echo "Frontend URL: $HOSTING_URL"
echo "Backend URL: $BACKEND_URL (internal only)"
echo ""
echo "If this is your first deploy, ensure you have:"
echo "  1. Added users to: deploy/frontend/allowed_users.txt"
echo "  2. Set Firebase config in: src/frontend/src/auth/firebase.js"
echo ""
echo "To update the whitelist: ./deploy/deploy.sh $ENV --proxy-only"
echo "========================================"
