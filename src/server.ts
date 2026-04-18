import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const YF_BASE = 'https://query1.finance.yahoo.com';

async function yfFetch(url: string) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`);
  return res.json();
}

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Search stocks
app.get('/api/search', async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.json([]);
    const data = await yfFetch(
      `${YF_BASE}/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`
    );
    const quotes = (data.quotes || [])
      .filter((r: any) => r.quoteType === 'EQUITY' || r.quoteType === 'ETF')
      .map((r: any) => ({
        symbol: r.symbol,
        name: r.shortname || r.longname || r.symbol,
        exchange: r.exchange,
        type: r.quoteType,
      }));
    res.json(quotes);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get quote info
app.get('/api/quote', async (req, res) => {
  try {
    const symbol = req.query.symbol as string;
    if (!symbol) return res.status(400).json({ error: 'symbol required' });
    const data = await yfFetch(
      `${YF_BASE}/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`
    );
    const q = data.quoteResponse?.result?.[0];
    if (!q) return res.status(404).json({ error: 'not found' });
    res.json({
      symbol: q.symbol,
      name: q.shortName || q.longName || q.symbol,
      price: q.regularMarketPrice,
      marketCap: q.marketCap,
      currency: q.currency,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get historical data
app.get('/api/history', async (req, res) => {
  try {
    const symbol = req.query.symbol as string;
    const range = (req.query.range as string) || '1y';
    if (!symbol) return res.status(400).json({ error: 'symbol required' });

    const intervalMap: Record<string, string> = {
      '1d': '5m',
      '5d': '15m',
      '1mo': '1d',
      '3mo': '1d',
      '6mo': '1d',
      '1y': '1d',
      '5y': '1wk',
    };
    const interval = intervalMap[range] || '1d';

    const data = await yfFetch(
      `${YF_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`
    );

    const result = data.chart?.result?.[0];
    if (!result) return res.status(404).json({ error: 'no data' });

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const meta = result.meta || {};

    const history = timestamps.map((t: number, i: number) => ({
      date: new Date(t * 1000).toISOString(),
      close: quotes.close?.[i],
      volume: quotes.volume?.[i],
    })).filter((d: any) => d.close != null);

    // Get shares outstanding from meta or separate quote call
    let sharesOutstanding = 0;
    try {
      const quoteData = await yfFetch(
        `${YF_BASE}/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`
      );
      const q = quoteData.quoteResponse?.result?.[0];
      sharesOutstanding = q?.sharesOutstanding || 0;
    } catch {}

    res.json({
      symbol: meta.symbol || symbol,
      name: meta.shortName || meta.longName || symbol,
      currency: meta.currency,
      marketCap: meta.marketCap,
      sharesOutstanding,
      data: history,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
