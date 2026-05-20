import { FILTER_CHIPS } from '../lib/constants.js';

export default function FilterBar({ active, onChange }) {
  return (
    <div className="flex gap-2 px-5 py-3 border-b border-gray-800 flex-wrap items-center bg-gray-900">
      <span className="text-xs text-gray-500">Filter:</span>
      {FILTER_CHIPS.map((chip) => (
        <button
          key={chip.value}
          onClick={() => onChange(chip)}
          className={`text-xs px-3 py-1 rounded-full border transition-colors font-medium
            ${active === chip.value
              ? 'bg-uf-blue text-white border-uf-blue'
              : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600 hover:text-gray-200'}`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
