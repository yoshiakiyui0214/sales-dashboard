"use client";

import { useState, useTransition } from "react";
import { analyzeLatestReport } from "@/actions/analyze";

type AnalysisResult = {
  summary: string;
  actions: string[];
};

export function AiAnalysis() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = () => {
    setError(null);
    startTransition(async () => {
      try {
        const analysis = await analyzeLatestReport();
        setResult(analysis);
      } catch (err) {
        setError(err instanceof Error ? err.message : "分析に失敗しました");
      }
    });
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[#1A2E5C]">AI分析コメント</h2>
        <button
          onClick={handleAnalyze}
          disabled={isPending}
          className="bg-[#1A2E5C] text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
        >
          {isPending ? "分析中..." : "AI分析を実行"}
        </button>
      </div>

      {error && (
        <p className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-zinc-600 mb-1">
              サマリー
            </p>
            <p className="text-zinc-800">{result.summary}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-600 mb-1">
              アクション提案
            </p>
            <ul className="list-disc list-inside space-y-1 text-zinc-800">
              {result.actions.map((action, i) => (
                <li key={i}>{action}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!result && !error && !isPending && (
        <p className="text-zinc-500 text-sm">
          ボタンを押すとAIが売上データを分析します。
        </p>
      )}
    </div>
  );
}