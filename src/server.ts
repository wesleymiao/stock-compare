import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const YF_BASE = 'https://query2.finance.yahoo.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// Yahoo Finance crumb/cookie management
let yfCookie = '';
let yfCrumb = '';
let crumbExpiry = 0;

async function refreshCrumb() {
  if (Date.now() < crumbExpiry && yfCrumb) return;
  // Get cookie
  const cookieRes = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': UA },
    redirect: 'manual',
  });
  const setCookies = cookieRes.headers.getSetCookie?.() || [];
  yfCookie = setCookies.map((c: string) => c.split(';')[0]).join('; ');

  // Get crumb
  const crumbRes = await fetch(`${YF_BASE}/v1/test/getcrumb`, {
    headers: { 'User-Agent': UA, Cookie: yfCookie },
  });
  yfCrumb = await crumbRes.text();
  crumbExpiry = Date.now() + 30 * 60 * 1000; // 30 min
}

async function yfFetch(url: string, needsCrumb = false) {
  const headers: Record<string, string> = { 'User-Agent': UA };
  if (needsCrumb) {
    await refreshCrumb();
    headers['Cookie'] = yfCookie;
    url += (url.includes('?') ? '&' : '?') + `crumb=${encodeURIComponent(yfCrumb)}`;
  }
  const res = await fetch(url, { headers });
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

    // Fetch chart data and quote data in parallel
    const [chartData, quoteData] = await Promise.all([
      yfFetch(
        `${YF_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`
      ),
      yfFetch(
        `${YF_BASE}/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`,
        true // needs crumb
      ).catch(() => null),
    ]);

    const result = chartData.chart?.result?.[0];
    if (!result) return res.status(404).json({ error: 'no data' });

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    const meta = result.meta || {};

    const history = timestamps.map((t: number, i: number) => ({
      date: new Date(t * 1000).toISOString(),
      close: quotes.close?.[i],
      volume: quotes.volume?.[i],
    })).filter((d: any) => d.close != null);

    const q = quoteData?.quoteResponse?.result?.[0];

    res.json({
      symbol: meta.symbol || symbol,
      name: q?.shortName || q?.longName || meta.longName || symbol,
      currency: meta.currency,
      marketCap: q?.marketCap || 0,
      sharesOutstanding: q?.sharesOutstanding || 0,
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
