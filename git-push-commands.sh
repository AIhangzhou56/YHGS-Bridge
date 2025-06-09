#!/bin/bash

# Git commands to push YHGS Bridge to GitHub

echo "Pushing YHGS Bridge to GitHub repository..."

# Configure git (replace with your GitHub credentials)
git config user.name "AIhangzhou56"
git config user.email "your.email@example.com"

# Add remote repository
git remote add origin https://github.com/AIhangzhou56/YHGS-Bridge.git

# Add all files
git add .

# Create commit with comprehensive description
git commit -m "YHGS Bridge - Multi-Chain Cryptocurrency Exchange Platform

Live Features:
- Real-time cryptocurrency data: Bitcoin $107,661 (+1.79%), Ethereum $2,532 (+0.79%)
- 60-second price updates from CoinGecko API
- Multi-chain support: Ethereum, BSC, Polygon, Solana
- Professional UI with gradient design and responsive layout
- Production-ready deployment scripts for CentOS servers

Technical Stack:
- Frontend: React, TypeScript, Tailwind CSS
- Backend: Node.js, Express, live API integration
- Database: PostgreSQL with Drizzle ORM
- Blockchain: Ethers.js for web3 integration
- Deployment: Nginx configurations for yhgs.chat domain

Components:
- Bridge interface for cross-chain transfers
- Mirror token system for ERC-20 to BSC
- Relay monitoring system
- Testnet environment for safe testing
- Real-time price tracking and bridge statistics

Deployment ready for yhgs.chat with server IP 185.238.3.202"

# Push to GitHub
git push -u origin main

echo "Successfully pushed to https://github.com/AIhangzhou56/YHGS-Bridge"