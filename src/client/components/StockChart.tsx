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

export default function StockChart({ stocks, range, mode, normalized }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const [dataCache, setDataCache] = useState<Map<string, StockData>>(new Map());
  const [loading, setLoading] = useState(false);

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
    };
  }, []);

  // Fetch data when stocks or range change
  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const newCache = new Map<string, StockData>();
      await Promise.all(
        stocks.map(async (s) => {
          const cacheKey = `${s.symbol}_${range}`;
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

    // Remove all series and recreate (needed when switching between intraday/daily time formats)
    seriesRef.current.forEach((series) => {
      chart.removeSeries(series);
    });
    seriesRef.current.clear();

    // Determine if we should normalize (percentage mode when comparing)
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
      const series = chart.addLineSeries({
        color: stock.color,
        lineWidth: isBenchmark ? 1 : 2,
        lineStyle: isBenchmark ? LineStyle.Dashed : LineStyle.Solid,
        title: stock.symbol,
        priceFormat: normalize
          ? { type: 'custom', formatter: (v: number) => v.toFixed(2) + '%' }
          : mode === 'marketcap'
          ? { type: 'custom', formatter: (v: number) => '$' + v.toFixed(1) + 'B' }
          : { type: 'price', precision: 2, minMove: 0.01 },
      });
      seriesRef.current.set(stock.symbol, series);
      series.setData(lineData);
    });

    chart.timeScale().fitContent();
  }, [dataCache, stocks, mode, normalized, range]);

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center z-10 rounded-lg">
          <span className="text-slate-300">Loading...</span>
        </div>
      )}
      <div ref={chartContainerRef} className="rounded-lg overflow-hidden" />
      {normalized && (
        <p className="text-xs text-slate-500 mt-2">
          * Showing percentage change (normalized)
        </p>
      )}
    </div>
  );
}
