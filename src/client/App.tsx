import React, { useState, useCallback, useEffect, useRef } from 'react';
import StockSearch from './components/StockSearch';
import StockChart from './components/StockChart';
import TimeSelector from './components/TimeSelector';

export interface StockEntry {
  symbol: string;
  name: string;
  color: string;
  isBenchmark?: boolean;
}

interface SavedList {
  id: string;
  name: string;
  stocks: StockEntry[];
}

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];

const DEFAULT_LISTS: SavedList[] = [
  {
    id: 'mag7',
    name: 'Mag 7 (US)',
    stocks: [
      { symbol: '^GSPC', name: 'S&P 500', color: '#ffffff', isBenchmark: true },
      { symbol: 'AAPL', name: 'Apple', color: COLORS[0] },
      { symbol: 'MSFT', name: 'Microsoft', color: COLORS[1] },
      { symbol: 'GOOGL', name: 'Alphabet', color: COLORS[2] },
      { symbol: 'AMZN', name: 'Amazon', color: COLORS[3] },
      { symbol: 'NVDA', name: 'NVIDIA', color: COLORS[4] },
      { symbol: 'META', name: 'Meta', color: COLORS[5] },
      { symbol: 'TSLA', name: 'Tesla', color: COLORS[6] },
    ],
  },
  {
    id: 'china-a',
    name: 'A股精选',
    stocks: [
      { symbol: '000300.SS', name: '沪深300', color: '#ffffff', isBenchmark: true },
      { symbol: '600519.SS', name: '贵州茅台', color: COLORS[0] },
      { symbol: '000858.SZ', name: '五粮液', color: COLORS[1] },
      { symbol: '601318.SS', name: '中国平安', color: COLORS[2] },
      { symbol: '600036.SS', name: '招商银行', color: COLORS[3] },
      { symbol: '000333.SZ', name: '美的集团', color: COLORS[4] },
      { symbol: '002594.SZ', name: '比亚迪', color: COLORS[5] },
      { symbol: '601888.SS', name: '中国中免', color: COLORS[6] },
    ],
  },
  {
    id: 'china-tech',
    name: '中概科技',
    stocks: [
      { symbol: '^GSPC', name: 'S&P 500', color: '#ffffff', isBenchmark: true },
      { symbol: 'BABA', name: 'Alibaba', color: COLORS[0] },
      { symbol: '0700.HK', name: 'Tencent', color: COLORS[1] },
      { symbol: 'PDD', name: 'PDD Holdings', color: COLORS[2] },
      { symbol: 'JD', name: 'JD.com', color: COLORS[3] },
      { symbol: 'BIDU', name: 'Baidu', color: COLORS[4] },
      { symbol: 'NIO', name: 'NIO', color: COLORS[5] },
      { symbol: 'LI', name: 'Li Auto', color: COLORS[6] },
    ],
  },
  {
    id: 'dca',
    name: '定投组合',
    stocks: [
      { symbol: '^GSPC', name: 'S&P 500', color: '#ffffff', isBenchmark: true },
      { symbol: 'VOO', name: 'Vanguard S&P 500', color: COLORS[0] },
      { symbol: 'QQQM', name: 'Invesco Nasdaq 100', color: COLORS[1] },
    ],
  },
  {
    id: 'holdings',
    name: '持仓股',
    stocks: [
      { symbol: '000300.SS', name: '沪深300', color: '#ffffff', isBenchmark: true },
      { symbol: '002410.SZ', name: '广联达', color: COLORS[0] },
      { symbol: '159609.SZ', name: '科创芯片ETF', color: COLORS[1] },
      { symbol: '513180.SS', name: '恒生科技ETF', color: COLORS[2] },
      { symbol: '512400.SS', name: '有色金属ETF', color: COLORS[3] },
      { symbol: '518880.SS', name: '黄金ETF', color: COLORS[4] },
      { symbol: '588000.SS', name: '科创50ETF', color: COLORS[5] },
      { symbol: '515030.SS', name: '新能源车ETF', color: COLORS[6] },
      { symbol: '159755.SZ', name: '电池ETF', color: COLORS[7 % COLORS.length] },
      { symbol: '159992.SZ', name: '创新药ETF', color: '#6366f1' },
    ],
  },
];

const STORAGE_KEY = 'stock-compare-saved-lists';
const ACTIVE_LIST_KEY = 'stock-compare-active-list';

function loadSavedLists(): SavedList[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge: keep defaults that aren't overridden, add user lists
      const defaultIds = DEFAULT_LISTS.map((l) => l.id);
      const userLists = parsed.filter((l: SavedList) => !defaultIds.includes(l.id));
      const overriddenDefaults = parsed.filter((l: SavedList) => defaultIds.includes(l.id));
      const nonOverriddenDefaults = DEFAULT_LISTS.filter(
        (d) => !overriddenDefaults.find((o: SavedList) => o.id === d.id)
      );
      return [...nonOverriddenDefaults, ...overriddenDefaults, ...userLists];
    }
  } catch {}
  return [...DEFAULT_LISTS];
}

export default function App() {
  const [savedLists, setSavedLists] = useState<SavedList[]>(loadSavedLists);
  const [activeListId, setActiveListId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_LIST_KEY) || 'mag7';
    } catch {
      return 'mag7';
    }
  });
  const [stocks, setStocks] = useState<StockEntry[]>(() => {
    const list = loadSavedLists().find((l) => l.id === (localStorage.getItem(ACTIVE_LIST_KEY) || 'mag7'));
    return list ? list.stocks : DEFAULT_LISTS[0].stocks;
  });
  const [range, setRange] = useState('3mo');
  const [mode, setMode] = useState<'price' | 'marketcap'>('price');
  const [normalized, setNormalized] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [saveTarget, setSaveTarget] = useState<'new' | string>('new');
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Persist saved lists
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLists));
  }, [savedLists]);

  // Persist active list
  useEffect(() => {
    if (activeListId) localStorage.setItem(ACTIVE_LIST_KEY, activeListId);
  }, [activeListId]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setListMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Check if current stocks differ from active list
  const activeList = savedLists.find((l) => l.id === activeListId);
  const hasUnsavedChanges = activeList
    ? JSON.stringify(stocks.map((s) => s.symbol)) !== JSON.stringify(activeList.stocks.map((s) => s.symbol))
    : true;

  const switchToList = (list: SavedList) => {
    setStocks(list.stocks);
    setActiveListId(list.id);
    setListMenuOpen(false);
  };

  const deleteList = (id: string) => {
    setSavedLists((prev) => prev.filter((l) => l.id !== id));
    if (activeListId === id) {
      setActiveListId(null);
    }
  };

  const openSaveDialog = () => {
    setSaveAsName('');
    setSaveTarget(activeListId || 'new');
    setShowSaveDialog(true);
  };

  const handleSave = () => {
    if (saveTarget === 'new') {
      const name = saveAsName.trim();
      if (!name) return;
      const id = 'custom-' + Date.now();
      const newList: SavedList = { id, name, stocks: [...stocks] };
      setSavedLists((prev) => [...prev, newList]);
      setActiveListId(id);
    } else {
      setSavedLists((prev) =>
        prev.map((l) => (l.id === saveTarget ? { ...l, stocks: [...stocks] } : l))
      );
      setActiveListId(saveTarget);
    }
    setShowSaveDialog(false);
  };

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

      {/* Saved Lists bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-slate-400 text-sm">Lists:</span>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setListMenuOpen(!listMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm font-medium hover:bg-slate-600 border border-slate-600"
          >
            📋 {activeList?.name || 'Select List'}
            {hasUnsavedChanges && <span className="text-amber-400">*</span>}
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {listMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-30 overflow-hidden">
              {savedLists.map((list) => (
                <div
                  key={list.id}
                  className={`flex items-center justify-between px-3 py-2 hover:bg-slate-700 cursor-pointer ${
                    list.id === activeListId ? 'bg-slate-700/50 border-l-2 border-blue-500' : ''
                  }`}
                >
                  <div className="flex-1" onClick={() => switchToList(list)}>
                    <div className="text-sm text-slate-200">{list.name}</div>
                    <div className="text-xs text-slate-500">{list.stocks.filter((s) => !s.isBenchmark).length} stocks</div>
                  </div>
                  {list.id.startsWith('custom-') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteList(list.id);
                      }}
                      className="text-slate-500 hover:text-red-400 text-sm px-1"
                      title="Delete list"
                    >
                      🗑
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={openSaveDialog}
          className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 border border-slate-600"
          title="Save current stocks as a list"
        >
          💾 Save
        </button>
      </div>

      {/* Save Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">Save List</h3>

            <div className="space-y-3 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="saveTarget"
                  checked={saveTarget === 'new'}
                  onChange={() => setSaveTarget('new')}
                  className="text-blue-500"
                />
                <span className="text-slate-300 text-sm">Save as new list</span>
              </label>

              {saveTarget === 'new' && (
                <input
                  type="text"
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  placeholder="List name..."
                  className="w-full px-3 py-2 bg-slate-700 text-white rounded-lg border border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              )}

              {savedLists.map((list) => (
                <label key={list.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="saveTarget"
                    checked={saveTarget === list.id}
                    onChange={() => setSaveTarget(list.id)}
                    className="text-blue-500"
                  />
                  <span className="text-slate-300 text-sm">
                    Overwrite "{list.name}"
                  </span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saveTarget === 'new' && !saveAsName.trim()}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

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
            style={{
              backgroundColor: s.isBenchmark ? '#ffffff11' : s.color + '22',
              color: s.color,
              border: `1px ${s.isBenchmark ? 'dashed' : 'solid'} ${s.color}`,
            }}
          >
            {s.isBenchmark ? `📊 ${s.name}` : s.name}
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
