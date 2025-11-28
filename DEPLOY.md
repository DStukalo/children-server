# Render.com Deployment Instructions

## Deployment Steps

### 1. Preparation

1. Make sure all changes are committed to git
2. Verify that `render.yaml` file exists

### 2. Deploy to Render.com

1. Go to https://render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository (or use public URL)
4. Settings:
   - **Name**: children-server
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (for testing)

### 3. Environment Variables

In the "Environment" section add:

- `NODE_ENV` = `production`
- `DATABASE_URL` = `postgresql://child_app_db_user:mSAAhAerx2ZZ9SbRyLMmfIAhfdgTWZmy@dpg-d4fg4ca4d50c73a1r6f0-a.frankfurt-postgres.render.com/child_app_db`
- `PORT` = `10000` (Render will assign port automatically)
- `WEBPAY_STORE_ID` = `411156299`
- `WEBPAY_SECRET_KEY` = `Alc913!@#XyZ529*d8MnO456pLDc297N`
- `WEBPAY_API_URL` = `https://sandbox.webpay.by`
- `PRODUCTION_URL` = `https://children-server.onrender.com` (or your Render URL)

### 4. After Deployment

1. Wait for successful deployment
2. Copy your service URL (e.g.: `https://children-server.onrender.com`)
3. Update `PRODUCTION_URL` in Render environment variables
4. Add to sandbox.webpay.by dashboard:
   ```
   https://children-server.onrender.com/api/payment/callback
   ```

### 5. Update Application

In `src/consts/consts.ts` production URL is already configured:
```typescript
export const API_BASE_URL = __DEV__
  ? Platform.OS === "android"
    ? "http://10.0.2.2:54322"
    : "http://localhost:54322"
  : "https://children-server.onrender.com";
```

When building APK in production mode (`__DEV__ = false`) the app will use production server.

## Verification

After deployment check:
- Server responds: `curl https://your-server.onrender.com/login`
- Callback URL works: add to webpay.by and test payment
