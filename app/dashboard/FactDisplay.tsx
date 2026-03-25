"use client";

import { useState, useEffect } from "react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { IoRefresh } from "react-icons/io5";

interface FactDisplayProps {
  movie: string;
}

export default function FactDisplay({ movie }: FactDisplayProps) {
  const [fact, setFact] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFact = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/fact");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch fact");
        return;
      }

      setFact(data.fact);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFact();
  }, []);

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">Fun Fact</h2>
        <button
          onClick={fetchFact}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <IoRefresh className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Loading..." : "New Fact"}
        </button>
      </div>

      <div className="min-h-25 flex items-center">
        {loading ? (
          <div className="flex items-center gap-3 text-gray-400">
            <AiOutlineLoading3Quarters className="w-5 h-5 animate-spin" />
            <span>Generating a fun fact about {movie}...</span>
          </div>
        ) : error ? (
          <p className="text-red-400">{error}</p>
        ) : (
          <p className="text-gray-300 leading-relaxed">{fact}</p>
        )}
      </div>
    </div>
  );
}