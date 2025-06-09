# YHGS Bridge Website Deployment Guide

## Option 1: Deploy to Your CentOS Server (Recommended)

### Prerequisites
- Server: 185.238.3.202
- Domains: yhgs.chat, app.yhgs.chat
- CentOS with root access

### Step 1: Run Deployment Script
```bash
chmod +x deploy-production.sh
./deploy-production.sh
```

### Step 2: Configure DNS
Add these A records to your domain registrar:
```
yhgs.chat        A    185.238.3.202
app.yhgs.chat    A    185.238.3.202
```

### Step 3: Install SSL Certificate
```bash
yum install certbot python3-certbot-nginx -y
certbot --nginx -d yhgs.chat -d app.yhgs.chat
```

### Result
- Frontend: https://yhgs.chat
- API: https://app.yhgs.chat
- Live crypto data updating every 60 seconds

## Option 2: Deploy to Replit (Current Environment)

### For Replit Deployment
1. Your app is already running in development
2. Use Replit's built-in deployment feature
3. Click "Deploy" button in Replit interface
4. Your app will be available at a .replit.app domain

## Option 3: Deploy to Other Hosting Services

### Vercel (Frontend Only)
```bash
# Build static frontend
npm run build

# Deploy to Vercel
npx vercel --prod
```

### Netlify (Frontend Only)
```bash
# Build static frontend
npm run build

# Upload dist/ folder to Netlify
```

### Railway (Full Stack)
```bash
# Connect GitHub repository
# Railway will auto-deploy both frontend and backend
```

### Heroku (Full Stack)
```bash
# Create Heroku app
heroku create yhgs-bridge

# Deploy
git push heroku main
```

## Current Status

✅ Development Environment Running
- Live crypto prices: Bitcoin $107,651 (+1.82%)
- API endpoints working correctly
- Real-time updates every 60 seconds
- No console errors

## Recommended Deployment Path

For your specific case with yhgs.chat domain:

1. **Use your CentOS server** (185.238.3.202)
2. **Run the deployment script** I created
3. **Configure DNS** to point to your server
4. **Install SSL certificates**

This gives you full control and the best performance for your live cryptocurrency data.