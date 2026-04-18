import React, { useState, useCallback } from 'react';
import StockSearch from './components/StockSearch';
import StockChart from './components/StockChart';
import TimeSelector from './components/TimeSelector';

export interface StockEntry {
  symbol: string;
  name: string;
  color: string;
}

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

export default function App() {
  const [stocks, setStocks] = useState<StockEntry[]>([]);
  const [range, setRange] = useState('1y');
  const [mode, setMode] = useState<'price' | 'marketcap'>('price');
  const [normalized, setNormalized] = useState(true);

  const addStock = useCallback((symbol: string, name: string) => {
    setStocks((prev) => {
      if (prev.find((s) => s.symbol === symbol)) return prev;
      return [...prev, { symbol, name, color: COLORS[prev.length % COLORS.length] }];
    });
  }, []);

  const removeStock = useCallback((symbol: string) => {
    setStocks((prev) => prev.filter((s) => s.symbol !== symbol));
  }, []);

  return (
    <div className="min-h-screen p-4 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">📈 Stock Compare</h1>

      <div className="flex flex-wrap gap-4 mb-4 items-start">
        <StockSearch onAdd={addStock} />

        <div className="flex gap-2">
          <button
            onClick={() => setMode('price')}
            className={`px-3 py-2 rounded text-sm font-medium ${
              mode === 'price' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Price
          </button>
          <button
            onClick={() => setMode('marketcap')}
            className={`px-3 py-2 rounded text-sm font-medium ${
              mode === 'marketcap' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Market Cap
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setNormalized(false)}
            className={`px-3 py-2 rounded text-sm font-medium ${
              !normalized ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Absolute
          </button>
          <button
            onClick={() => setNormalized(true)}
            className={`px-3 py-2 rounded text-sm font-medium ${
              normalized ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Normalized %
          </button>
        </div>
      </div>

      <TimeSelector range={range} onChange={setRange} />

      {/* Stock tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {stocks.map((s) => (
          <span
            key={s.symbol}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium"
            style={{ backgroundColor: s.color + '22', color: s.color, border: `1px solid ${s.color}` }}
          >
            {s.symbol}
            <button
              onClick={() => removeStock(s.symbol)}
              className="ml-1 hover:opacity-70 text-lg leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {stocks.length === 0 ? (
        <div className="flex items-center justify-center h-96 bg-slate-800/50 rounded-lg border border-slate-700">
          <p className="text-slate-400 text-lg">Search and add stocks to compare</p>
        </div>
      ) : (
        <StockChart stocks={stocks} range={range} mode={mode} normalized={normalized} />
      )}
    </div>
  );
}
