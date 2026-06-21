import React from 'react';

const RANGES = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '3y', '4y', '5y', '6y', '7y', '8y', '9y', '10y'];
const LABELS: Record<string, string> = {
  '1d': '1D',
  '5d': '5D',
  '1mo': '1M',
  '3mo': '3M',
  '6mo': '6M',
  '1y': '1Y',
  '2y': '2Y',
  '3y': '3Y',
  '4y': '4Y',
  '5y': '5Y',
  '6y': '6Y',
  '7y': '7Y',
  '8y': '8Y',
  '9y': '9Y',
  '10y': '10Y',
};

interface Props {
  range: string;
  onChange: (r: string) => void;
}

export default function TimeSelector({ range, onChange }: Props) {
  return (
    <div className="flex gap-1 mb-4">
      {RANGES.map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-3 py-1.5 rounded text-sm font-medium ${
            range === r ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          {LABELS[r]}
        </button>
      ))}
    </div>
  );
}
