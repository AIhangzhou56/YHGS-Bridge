// Update API endpoints for static deployment
// This ensures frontend calls the correct API domain

import { queryClient } from './client/src/lib/queryClient';

const config = {
  development: {
    apiUrl: 'http://localhost:5000'
  },
  production: {
    apiUrl: 'https://api.yourdomain.com'
  }
};

const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? config.production.apiUrl 
  : config.development.apiUrl;

export { API_BASE_URL };