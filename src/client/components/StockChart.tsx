import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, LineData, Time, LineStyle } from 'lightweight-charts';
import type { StockEntry } from '../App';

interface Props {
  stocks: StockEntry[];
  range: string;
  mode: 'price' | 'marketcap';
  normalized: boolean;
}

interface StockData {
  symbol: string;
  name: string;
  sharesOutstanding: number;
  marketCap: number;
  data: { date: string; close: number; volume: number }[];
}

interface TooltipData {
  time: string;
  items: { symbol: string; name: string; color: string; value: string }[];
}

export default function StockChart({ stocks, range, mode, normalized }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const volumeSeriesRef = useRef<Map<string, ISeriesApi<'Histogram'>>>(new Map());
  const [dataCache, setDataCache] = useState<Map<string, StockData>>(new Map());
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Create chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#1e293b' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#334155' },
        horzLines: { color: '#334155' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      crosshair: {
        mode: 0,
      },
      timeScale: {
        borderColor: '#475569',
        timeVisible: true,
      },
      rightPriceScale: {
        borderColor: '#475569',
      },
    });

    chartRef.current = chart;

    // Crosshair move handler for tooltip
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }

      const items: TooltipData['items'] = [];
      const stockList = stocks;

      seriesRef.current.forEach((series, symbol) => {
        const data = param.seriesData.get(series);
        if (data && 'value' in data) {
          const stock = stockList.find(s => s.symbol === symbol);
          const color = stock?.color || '#ffffff';
          let formatted: string;
          if (normalized) {
            formatted = (data.value as number).toFixed(2) + '%';
          } else if (mode === 'marketcap') {
            formatted = '$' + (data.value as number).toFixed(1) + 'B';
          } else {
            formatted = '$' + (data.value as number).toFixed(2);
          }
          items.push({ symbol, name: stock?.name || symbol, color, value: formatted });
        }
      });

      if (items.length > 0) {
        let timeStr: string;
        if (typeof param.time === 'number') {
          timeStr = new Date(param.time * 1000).toLocaleString();
        } else {
          timeStr = String(param.time);
        }
        setTooltip({ time: timeStr, items });
        setTooltipPos({ x: param.point.x, y: param.point.y });
      } else {
        setTooltip(null);
      }
    });

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current.clear();
      volumeSeriesRef.current.clear();
    };
  }, []);

  // Re-subscribe crosshair when stocks/mode/normalized change
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // The crosshair handler uses closure over stocks/mode/normalized
    // We need to re-subscribe
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setTooltip(null);
        return;
      }

      const items: TooltipData['items'] = [];

      seriesRef.current.forEach((series, symbol) => {
        const data = param.seriesData.get(series);
        if (data && 'value' in data) {
          const stock = stocks.find(s => s.symbol === symbol);
          const color = stock?.color || '#ffffff';
          let formatted: string;
          if (normalized) {
            formatted = (data.value as number).toFixed(2) + '%';
          } else if (mode === 'marketcap') {
            formatted = '$' + (data.value as number).toFixed(1) + 'B';
          } else {
            formatted = '$' + (data.value as number).toFixed(2);
          }
          items.push({ symbol, name: stock?.name || symbol, color, value: formatted });
        }
      });

      if (items.length > 0) {
        let timeStr: string;
        if (typeof param.time === 'number') {
          timeStr = new Date(param.time * 1000).toLocaleString();
        } else {
          timeStr = String(param.time);
        }
        setTooltip({ time: timeStr, items });
        setTooltipPos({ x: param.point.x, y: param.point.y });
      } else {
        setTooltip(null);
      }
    });
  }, [stocks, mode, normalized]);

  // Fetch data when stocks or range change
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const newCache = new Map<string, StockData>();
      await Promise.all(
        stocks.map(async (s) => {
          try {
            const res = await fetch(`/api/history?symbol=${encodeURIComponent(s.symbol)}&range=${range}`);
            const data = await res.json();
            newCache.set(s.symbol, data);
          } catch (e) {
            console.error(`Failed to fetch ${s.symbol}`, e);
          }
        })
      );
      setDataCache(newCache);
      setLoading(false);
    };
    if (stocks.length > 0) fetchAll();
    else setDataCache(new Map());
  }, [stocks.map((s) => s.symbol).join(','), range]);

  // Update chart series
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const isIntraday = range === '1d' || range === '5d';

    // Remove all series and recreate
    seriesRef.current.forEach((series) => {
      chart.removeSeries(series);
    });
    seriesRef.current.clear();
    volumeSeriesRef.current.forEach((series) => {
      chart.removeSeries(series);
    });
    volumeSeriesRef.current.clear();

    const normalize = normalized;

    const toTime = (dateStr: string): Time => {
      if (isIntraday) {
        return Math.floor(new Date(dateStr).getTime() / 1000) as unknown as Time;
      }
      return dateStr.split('T')[0] as Time;
    };

    stocks.forEach((stock) => {
      const stockData = dataCache.get(stock.symbol);
      if (!stockData || !stockData.data || stockData.data.length === 0) return;

      let lineData: LineData[];
      const rawData = stockData.data;

      if (mode === 'marketcap' && stockData.marketCap) {
        const currentPrice = rawData[rawData.length - 1].close;
        const currentMarketCap = stockData.marketCap;
        if (normalize) {
          const basePrice = rawData[0].close;
          lineData = rawData.map((d) => ({
            time: toTime(d.date),
            value: ((d.close - basePrice) / basePrice) * 100,
          }));
        } else {
          lineData = rawData.map((d) => ({
            time: toTime(d.date),
            value: (currentMarketCap * (d.close / currentPrice)) / 1e9,
          }));
        }
      } else {
        if (normalize) {
          const basePrice = rawData[0].close;
          lineData = rawData.map((d) => ({
            time: toTime(d.date),
            value: ((d.close - basePrice) / basePrice) * 100,
          }));
        } else {
          lineData = rawData.map((d) => ({
            time: toTime(d.date),
            value: d.close,
          }));
        }
      }

      const isBenchmark = stock.isBenchmark === true;
      const useSeparateScale = isBenchmark && !normalize;
      const series = chart.addLineSeries({
        color: stock.color,
        lineWidth: 2,
        lineStyle: isBenchmark ? LineStyle.Dashed : LineStyle.Solid,
        title: stock.name,
        priceScaleId: useSeparateScale ? 'benchmark' : 'right',
        priceFormat: normalize
          ? { type: 'custom', formatter: (v: number) => v.toFixed(2) + '%' }
          : mode === 'marketcap'
          ? { type: 'custom', formatter: (v: number) => '$' + v.toFixed(1) + 'B' }
          : { type: 'price', precision: 2, minMove: 0.01 },
      });
      if (useSeparateScale) {
        series.priceScale().applyOptions({
          scaleMargins: { top: 0.05, bottom: 0.05 },
          visible: false,
        });
      }
      seriesRef.current.set(stock.symbol, series);
      series.setData(lineData);

      // Add volume histogram (skip for benchmarks like ^GSPC which have no meaningful volume)
      if (!isBenchmark && rawData[0]?.volume > 0) {
        const volumeData = rawData.map((d) => ({
          time: toTime(d.date),
          value: d.volume,
          color: stock.color + '30',
        }));

        const volumeSeries = chart.addHistogramSeries({
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        });
        volumeSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
          visible: false,
        });
        volumeSeries.setData(volumeData as any);
        volumeSeriesRef.current.set(stock.symbol, volumeSeries);
      }
    });

    // Add prominent 0% baseline in normalized mode
    if (normalize) {
      const firstSeries = seriesRef.current.values().next().value;
      if (firstSeries) {
        firstSeries.createPriceLine({
          price: 0,
          color: '#94a3b8',
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: '0%',
        });
      }
    }

    chart.timeScale().fitContent();
  }, [dataCache, stocks, mode, normalized, range]);

  // Compute tooltip position - clamp to chart bounds
  const getTooltipStyle = (): React.CSSProperties => {
    const left = Math.min(tooltipPos.x + 16, (chartContainerRef.current?.clientWidth || 800) - 220);
    const top = Math.max(tooltipPos.y - 20, 0);
    return {
      position: 'absolute',
      left: `${left}px`,
      top: `${top}px`,
      zIndex: 20,
      pointerEvents: 'none' as const,
    };
  };

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-10 rounded-lg">
          <span className="text-slate-300">Loading...</span>
        </div>
      )}
      <div ref={chartContainerRef} className="rounded-lg overflow-hidden" />
      {tooltip && (
        <div style={getTooltipStyle()}>
          <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 shadow-xl text-xs">
            <div className="text-slate-400 mb-1 font-mono">{tooltip.time}</div>
            {tooltip.items.map((item) => (
              <div key={item.symbol} className="flex items-center justify-between gap-4 py-0.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-300">{item.name}</span>
                </div>
                <span className="font-mono text-white">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {normalized && (
        <p className="text-xs text-slate-500 mt-2">
          * Showing percentage change (normalized)
        </p>
      )}
    </div>
  );
}
