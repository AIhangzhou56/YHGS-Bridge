# YHGS Bridge Final Setup

## Server Status ✅
- **Server IP**: 185.238.3.202
- **API Service**: Running on port 5000
- **Frontend**: Deployed to /var/www/yhgs-frontend
- **Backend**: Deployed to /var/www/yhgs-api

## DNS Configuration Required

Add these A records to your domain registrar:

```
yhgs.chat        A    185.238.3.202
app.yhgs.chat    A    185.238.3.202
```

## Test Your Deployment

```bash
# Test API directly with IP
curl http://185.238.3.202:5000/api/tokens

# Test after DNS propagation
curl http://app.yhgs.chat/api/tokens

# Check service status
systemctl status yhgs-api
```

## SSL Certificate Installation

After DNS propagation (usually 5-60 minutes):

```bash
# Install Certbot if not installed
yum install certbot python3-certbot-nginx -y

# Get SSL certificates
certbot --nginx -d yhgs.chat -d app.yhgs.chat
```

## Live Cryptocurrency Data

Your API is serving real-time data:
- Bitcoin: $106,062 (+0.72%)
- Ethereum: $2,496 (-0.42%) 
- BNB: $651.35 (+0.44%)
- Updates every 60 seconds

## Service Management

```bash
# Restart API service
systemctl restart yhgs-api

# View logs
journalctl -u yhgs-api -f

# Reload Nginx
systemctl reload nginx
```

## Architecture

```
Internet → yhgs.chat (Static Frontend) → app.yhgs.chat (API) → Live Crypto Data
```

Your bridge platform is ready for production use!