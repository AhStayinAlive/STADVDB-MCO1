// src/components/Filters.jsx
import React, { useState, useEffect } from "react";

export default function Filters({ initial = {}, onApply }) {
  const [yearFrom, setYearFrom] = useState(initial.yearFrom ?? 2018);
  const [yearTo, setYearTo] = useState(initial.yearTo ?? 2024);
  const [product, setProduct] = useState(initial.product ?? "");

  // optional: keep parent updated (debounced or onChange)
  useEffect(() => {
    // no-op; we use explicit Apply button
  }, []);

  const apply = () => {
    onApply && onApply({ yearFrom, yearTo, product: product || null });
  };

  


  return (
    <div className="p-3 bg-gray-800 rounded">
      <label className="block mb-2">Year from</label>
      <input
        type="number"
        value={yearFrom}
        onChange={(e) => setYearFrom(Number(e.target.value))}
        className="w-full mb-3 p-2 rounded bg-gray-700"
      />

      <label className="block mb-2">Year to</label>
      <input
        type="number"
        value={yearTo}
        onChange={(e) => setYearTo(Number(e.target.value))}
        className="w-full mb-3 p-2 rounded bg-gray-700"
      />

      <label className="block mb-2">Product</label>
      <input
        value={product}
        onChange={(e) => setProduct(e.target.value)}
        placeholder="optional product code"
        className="w-full mb-3 p-2 rounded bg-gray-700"
      />

      <button
        onClick={apply}
        className="mt-2 px-4 py-2 bg-blue-600 rounded hover:bg-blue-500"
      >
        Apply
      </button>
    </div>
  );
}
