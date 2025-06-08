import { storage } from './storage';

interface CoinGeckoPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  last_updated: string;
}

interface TokenMapping {
  symbol: string;
  coinGeckoId: string;
}

export class PriceService {
  private readonly API_BASE = 'https://api.coingecko.com/api/v3';
  private readonly UPDATE_INTERVAL = 60000; // 1 minute
  private updateTimer: NodeJS.Timeout | null = null;

  private readonly TOKEN_MAPPINGS: TokenMapping[] = [
    { symbol: 'ETH', coinGeckoId: 'ethereum' },
    { symbol: 'BNB', coinGeckoId: 'binancecoin' },
    { symbol: 'USDT', coinGeckoId: 'tether' },
    { symbol: 'USDC', coinGeckoId: 'usd-coin' },
    { symbol: 'DAI', coinGeckoId: 'dai' },
    { symbol: 'WBTC', coinGeckoId: 'wrapped-bitcoin' },
    { symbol: 'UNI', coinGeckoId: 'uniswap' },
    { symbol: 'LINK', coinGeckoId: 'chainlink' },
    { symbol: 'MATIC', coinGeckoId: 'matic-network' },
    { symbol: 'AVAX', coinGeckoId: 'avalanche-2' }
  ];

  async startPriceUpdates(): Promise<void> {
    console.log('Starting real-time cryptocurrency price updates...');
    
    // Initial price fetch
    await this.updateAllPrices();
    
    // Set up recurring updates
    this.updateTimer = setInterval(async () => {
      try {
        await this.updateAllPrices();
      } catch (error) {
        console.error('Price update failed:', error);
      }
    }, this.UPDATE_INTERVAL);

    console.log(`Price updates scheduled every ${this.UPDATE_INTERVAL / 1000} seconds`);
  }

  async updateAllPrices(): Promise<void> {
    try {
      const coinIds = this.TOKEN_MAPPINGS.map(mapping => mapping.coinGeckoId).join(',');
      const url = `${this.API_BASE}/coins/markets?vs_currency=usd&ids=${coinIds}&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h`;
      
      console.log('Fetching live cryptocurrency prices from CoinGecko...');
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const priceData: CoinGeckoPrice[] = await response.json();
      const updatePromises: Promise<void>[] = [];

      for (const coinData of priceData) {
        const mapping = this.TOKEN_MAPPINGS.find(m => m.coinGeckoId === coinData.id);
        if (!mapping) continue;

        const token = await storage.getTokenBySymbol(mapping.symbol);
        if (!token) continue;

        const price = coinData.current_price.toFixed(2);
        const change24h = coinData.price_change_percentage_24h?.toFixed(2) || '0.00';

        updatePromises.push(
          storage.updateTokenPrice(token.id, price, change24h)
        );

        console.log(`Updated ${mapping.symbol}: $${price} (${change24h > '0' ? '+' : ''}${change24h}%)`);
      }

      await Promise.all(updatePromises);
      console.log(`Successfully updated prices for ${priceData.length} cryptocurrencies`);

    } catch (error) {
      console.error('Failed to update cryptocurrency prices:', error);
      throw error;
    }
  }

  async getTokenPrice(symbol: string): Promise<{ price: string; change24h: string } | null> {
    try {
      const mapping = this.TOKEN_MAPPINGS.find(m => m.symbol === symbol.toUpperCase());
      if (!mapping) {
        throw new Error(`No mapping found for token: ${symbol}`);
      }

      const url = `${this.API_BASE}/simple/price?ids=${mapping.coinGeckoId}&vs_currencies=usd&include_24hr_change=true`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      const coinData = data[mapping.coinGeckoId];
      
      if (!coinData) {
        throw new Error(`No price data returned for ${symbol}`);
      }

      return {
        price: coinData.usd.toFixed(2),
        change24h: (coinData.usd_24h_change || 0).toFixed(2)
      };

    } catch (error) {
      console.error(`Failed to fetch price for ${symbol}:`, error);
      return null;
    }
  }

  stopPriceUpdates(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
      console.log('Stopped cryptocurrency price updates');
    }
  }

  async validateApiConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE}/ping`);
      const data = await response.json();
      return data.gecko_says === "(V3) To the Moon!";
    } catch (error) {
      console.error('CoinGecko API connection test failed:', error);
      return false;
    }
  }

  async getMarketSummary(): Promise<{
    totalMarketCap: number;
    totalVolume: number;
    btcDominance: number;
    activeCryptocurrencies: number;
  } | null> {
    try {
      const url = `${this.API_BASE}/global`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const { data } = await response.json();
      
      return {
        totalMarketCap: data.total_market_cap.usd,
        totalVolume: data.total_volume.usd,
        btcDominance: data.market_cap_percentage.btc,
        activeCryptocurrencies: data.active_cryptocurrencies
      };

    } catch (error) {
      console.error('Failed to fetch market summary:', error);
      return null;
    }
  }
}

export const priceService = new PriceService();