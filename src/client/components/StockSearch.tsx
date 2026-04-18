import React, { useState, useRef, useEffect } from 'react';

interface Props {
  onAdd: (symbol: string, name: string) => void;
}

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

export default function StockSearch({ onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = (q: string) => {
    setQuery(q);
    clearTimeout(timerRef.current);
    if (!q.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data);
        setOpen(true);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 300);
  };

  const select = (r: SearchResult) => {
    onAdd(r.symbol, r.name);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-72">
      <input
        type="text"
        value={query}
        onChange={(e) => search(e.target.value)}
        placeholder="Search stocks (e.g. AAPL, 0700.HK)..."
        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
      />
      {loading && <span className="absolute right-3 top-2.5 text-xs text-slate-400">...</span>}
      {open && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-600 rounded shadow-lg max-h-60 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.symbol}
              onClick={() => select(r)}
              className="w-full text-left px-3 py-2 hover:bg-slate-700 text-sm"
            >
              <span className="font-medium text-white">{r.symbol}</span>
              <span className="text-slate-400 ml-2">{r.name}</span>
              <span className="text-slate-500 ml-2 text-xs">{r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
