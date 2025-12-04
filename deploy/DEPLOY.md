# Deploying Lyre Studio to Google Cloud

## Overview

Lyre Studio deploys as a three-tier architecture on Google Cloud:

| Component | Service | Purpose |
|-----------|---------|---------|
| **Frontend** | Firebase Hosting | Serves React app via global CDN |
| **API Proxy** | Cloud Run | Authenticates users, enforces whitelist, proxies requests |
| **Backend** | Cloud Run + L4 GPU | ML inference (translation, voice synthesis) |

### Quick Reference

```bash
# Full deploy (backend + proxy + frontend)
./deploy/deploy.sh dev

# Frontend only (proxy + static files)
./deploy/deploy.sh dev --frontend-only

# Backend only (GPU service)
./deploy/deploy.sh dev --backend-only

# Proxy only (auth layer, after whitelist changes)
./deploy/deploy.sh dev --proxy-only
```

### Deploy Folder Contents

```
deploy/
├── deploy.sh              # Main deployment script
├── cloudbuild.yaml        # Backend Docker build config
├── firebase.json          # Firebase Hosting config
├── .firebaserc            # Firebase project aliases
├── static/                # Built frontend (auto-generated, gitignored)
├── frontend/              # API proxy service
│   ├── Dockerfile
│   ├── main.py            # FastAPI proxy with auth
│   ├── allowed_users.txt  # Email whitelist
│   └── requirements.txt
└── DEPLOY.md              # This guide

# At repo root:
env.example                # Template for .env (HF_TOKEN)
```

---

## Architecture

```
Users (Public Internet)
         │
         │  https://lyrestudio-dev.web.app
         ▼
┌─────────────────────────────────┐
│   FIREBASE HOSTING              │
│                                 │
│   • Serves React static files   │
│   • CDN for fast loading        │
│   • Rewrites /api/* to proxy    │
└──────────────┬──────────────────┘
               │
               │  /api/* requests
               ▼
┌─────────────────────────────────┐     service-to-service auth     ┌─────────────────────────────────┐
│   API PROXY SERVICE             │ ───────────────────────────────▶│   BACKEND SERVICE               │
│   (Cloud Run, Public)           │                                 │   (Cloud Run + L4 GPU)          │
│                                 │                                 │                                 │
│   • Verifies Firebase tokens    │                                 │   • Internal only (no public)   │
│   • Checks email whitelist      │                                 │   • ML inference only           │
│   • Proxies to backend          │                                 │   • Requires service auth       │
└─────────────────────────────────┘                                 └─────────────────────────────────┘
```

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **gcloud CLI** installed: [Install Guide](https://cloud.google.com/sdk/docs/install)
3. **Firebase CLI** installed: `npm install -g firebase-tools`
4. **Bun** installed: `curl -fsSL https://bun.sh/install | bash`

## Step 1: Create GCP Projects

Go to [Google Cloud Console](https://console.cloud.google.com/):

1. Create project: `lyrestudio-dev` (for development)
2. Create project: `lyrestudio` (for production)

Or via CLI:
```bash
gcloud projects create lyrestudio-dev --name="Lyre Studio Dev"
gcloud projects create lyrestudio --name="Lyre Studio"
```

## Step 2: Enable GCP APIs

For each project:

```bash
# Dev
gcloud config set project lyrestudio-dev
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

# Prod
gcloud config set project lyrestudio
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## Step 3: Set Up Firebase

Go to [Firebase Console](https://console.firebase.google.com/):

For **each** project (`lyrestudio-dev` and `lyrestudio`):

1. **Create Firebase project** → Select your existing GCP project
2. Enable Google Analytics (optional but recommended)
3. **Authentication** → **Get started** → Enable **Google** sign-in
4. **Hosting** → **Get started** (just click through the wizard)
5. **Authentication** → **Settings** → **Authorized domains**:
   - Add `lyrestudio-dev.web.app` (for dev)
   - Add `lyrestudio.web.app` (for prod)

## Step 4: Set Up Hugging Face Token

The backend downloads ML models during the Docker build. To avoid rate limits, you need a Hugging Face token.

1. Create an account at [huggingface.co](https://huggingface.co/)
2. Go to [Settings → Access Tokens](https://huggingface.co/settings/tokens)
3. Create a new token (read access is fine)
4. Create a `.env` file in the repo root:

```bash
cp env.example .env
# Edit .env and add your token
```

Your `.env` file should contain:
```
HF_TOKEN=hf_your_token_here
```

## Step 5: Get Firebase Config

For **each** project:

1. Firebase Console → ⚙️ **Project settings**
2. Scroll to **Your apps** → Click **Add app** → Select **Web** (`</>`)
3. Name it (e.g., "Lyre Frontend")
4. Copy the `firebaseConfig` object

Update `src/frontend/src/auth/firebase.js` with both configs:

```javascript
const devConfig = {
    apiKey: "AIzaSy...",
    authDomain: "lyrestudio-dev.firebaseapp.com",
    projectId: "lyrestudio-dev",
    // ... rest of config
};

const prodConfig = {
    apiKey: "AIzaSy...",
    authDomain: "lyrestudio.firebaseapp.com",
    projectId: "lyrestudio",
    // ... rest of config
};
```

## Step 6: Login to CLI Tools

```bash
# Login to Google Cloud
gcloud auth login

# Login to Firebase
firebase login
```

## Step 7: Add Allowed Users

Edit `deploy/frontend/allowed_users.txt`:

```
# One email per line
your-email@gmail.com
friend@gmail.com
```

## Step 8: Deploy

From the repository root:

```bash
# Make script executable (once)
chmod +x deploy/deploy.sh

# Deploy to dev
./deploy/deploy.sh dev

# Deploy to prod
./deploy/deploy.sh prod
```

This deploys:
1. **Backend**: Cloud Run with L4 GPU, internal-only access
2. **API Proxy**: Cloud Run for auth verification and proxying
3. **Static Files**: Firebase Hosting for React app

### Deployment Options

```bash
# Full deployment (backend + proxy + static)
./deploy/deploy.sh dev

# Frontend only (proxy + static files)
./deploy/deploy.sh dev --frontend-only

# API proxy only (no static rebuild)
./deploy/deploy.sh dev --proxy-only

# Backend only
./deploy/deploy.sh dev --backend-only
```

## Step 9: Visit Your App

**https://lyrestudio-dev.web.app**

## Updating the Whitelist

1. Edit `deploy/frontend/allowed_users.txt`
2. Redeploy: `./deploy/deploy.sh dev --proxy-only`

## Local Development

Local development works without authentication:

```bash
# Terminal 1: Start backend
./scripts/start-backend.sh

# Terminal 2: Start frontend
./scripts/start-frontend.sh
```

The React app detects `localhost` and auto-logs in as a dev user, bypassing Firebase.

## Cost Estimate

| Service | Spec | Cost |
|---------|------|------|
| Firebase Hosting | CDN | Free (generous tier) |
| API Proxy | 1 vCPU, 512MB | ~$0-5/month (free tier eligible) |
| Backend | 4 vCPU, 16GB, L4 GPU | ~$0.70/hr when running, $0 idle |
| Firebase Auth | - | Free (generous tier) |

With light usage (10-20 generations/day), expect **~$5-15/month** total.

## Troubleshooting

### "Authentication required" error
- Ensure you're logged in with a Google account
- Check browser console for Firebase errors
- Verify Firebase config in `src/frontend/src/auth/firebase.js`

### "User not in whitelist" error
- Add your email to `deploy/frontend/allowed_users.txt`
- Redeploy: `./deploy/deploy.sh dev --proxy-only`

### GPU quota error
- Go to [IAM & Admin → Quotas](https://console.cloud.google.com/iam-admin/quotas)
- Search for "NVIDIA L4"
- Request quota increase for `us-central1`

### Firebase Hosting not updating
```bash
# Force rebuild and deploy
./deploy/deploy.sh dev --frontend-only
```

### Backend not responding
```bash
# Check logs
gcloud run logs read lyre-backend --region us-central1 --limit 50
```

## Viewing Logs

```bash
# API Proxy logs (includes user activity)
gcloud run logs read lyre-frontend --region us-central1 --limit 50

# Backend logs
gcloud run logs read lyre-backend --region us-central1 --limit 50
```

Or view in the [GCP Console Logs Explorer](https://console.cloud.google.com/logs).
