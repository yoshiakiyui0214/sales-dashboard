"use client";

import { useState, useCallback } from "react";
import { parseSalesCsv, type ParseResult } from "@/lib/csv/parser";
import { uploadAndSaveCsv } from "@/actions/upload";

type SaveStatus = "idle" | "saving" | "saved" | "error" | "skipped";

/** "2025-11" → "2025年11月" */
function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  return `${year}年${Number(m)}月`;
}

function formatMonthRange(months: string[]): string {
  if (months.length === 0) return "";
  if (months.length === 1) return formatMonth(months[0]);
  return `${formatMonth(months[0])}〜${formatMonth(months[months.length - 1])}`;
}

export default function UploadPage() {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string>("");
  const [targetMonths, setTargetMonths] = useState<string[]>([]);
  const [replacedCount, setReplacedCount] = useState<number>(0);

  const handleFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setFileName(file.name);
    setSaveStatus("idle");
    setSaveError("");
    setTargetMonths([]);
    setReplacedCount(0);

    try {
      // 1. まずブラウザ側でパース結果をプレビュー表示
      const parsed = await parseSalesCsv(file);
      setResult(parsed);
      setIsLoading(false);

      // 有効な行がなければ保存しない
      if (parsed.valid.length === 0) {
        setSaveStatus("skipped");
        return;
      }

      // 2. Server Actionでデータベースに保存（同じ月のデータは置き換え）
      setSaveStatus("saving");
      const formData = new FormData();
      formData.append("file", file);
      const saveResult = await uploadAndSaveCsv(formData);

      setTargetMonths(saveResult.targetMonths ?? []);

      if (saveResult.success) {
        setSaveStatus("saved");
        setReplacedCount(saveResult.replacedCount ?? 0);
      } else {
        setSaveStatus("error");
        setSaveError(saveResult.error ?? "不明なエラーが発生しました");
      }
    } catch {
      setIsLoading(false);
      setSaveStatus("error");
      setSaveError("ファイルの処理中にエラーが発生しました");
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      // 同じファイルを続けて選んでも反応するようにリセット
      e.target.value = "";
    },
    [handleFile]
  );

  return (
    <main className="min-h-screen bg-brand-light flex flex-col items-center p-8">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-brand-navy">
            売上CSVアップロード
          </h1>
          <a href="/dashboard" className="text-sm text-brand-navy underline">
            ダッシュボードへ
          </a>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging
              ? "border-brand-navy bg-blue-50"
              : "border-zinc-300 bg-white"
          }`}
        >
          <p className="text-zinc-600 mb-4">
            CSVファイルをここにドラッグ&ドロップ、または
          </p>
          <label className="inline-block bg-brand-navy text-white px-4 py-2 rounded cursor-pointer hover:opacity-90">
            ファイルを選択
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={onFileInputChange}
            />
          </label>
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          ※ CSVに含まれる月のデータがすでに登録されている場合は、新しいCSVの内容で置き換わります(二重に計上されることはありません)。
        </p>

        {isLoading && <p className="mt-4 text-zinc-600">読み込み中...</p>}

        {result && !isLoading && (
          <div className="mt-6 bg-white rounded-lg border p-6">
            <p className="font-semibold text-brand-navy mb-2">{fileName}</p>
            <p className="text-sm text-zinc-700">
              全 {result.totalRows} 行中、
              <span className="text-green-600 font-semibold">
                {" "}
                {result.valid.length} 行成功
              </span>
              {result.invalid.length > 0 && (
                <span className="text-red-600 font-semibold">
                  {" "}
                  / {result.invalid.length} 行スキップ
                </span>
              )}
            </p>

            {saveStatus === "saving" && (
              <p className="mt-3 text-sm text-zinc-600">
                データベースに保存中...
              </p>
            )}

            {saveStatus === "saved" && (
              <div className="mt-3 text-sm">
                <p className="text-green-600 font-semibold">
                  ✓ {formatMonthRange(targetMonths)}のデータを取り込みました
                </p>
                <p className="text-zinc-600 mt-1">
                  {replacedCount > 0
                    ? `同じ月の古いデータ ${replacedCount.toLocaleString()} 件を、今回のCSVの内容で置き換えました。`
                    : "新しい月のデータとして追加しました。"}
                </p>
                <a
                  href="/dashboard"
                  className="inline-block mt-3 bg-brand-navy text-white px-4 py-2 rounded hover:opacity-90"
                >
                  ダッシュボードを見る
                </a>
              </div>
            )}

            {saveStatus === "skipped" && (
              <p className="mt-3 text-sm text-red-600 font-semibold">
                有効な行が1件もないため、保存していません。カラム名や日付の形式を確認してください。
              </p>
            )}

            {saveStatus === "error" && (
              <p className="mt-3 text-sm text-red-600 font-semibold">
                保存エラー: {saveError}
              </p>
            )}

            {result.invalid.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-red-600 mb-2">
                  スキップされた行:
                </p>
                <ul className="text-xs text-zinc-600 space-y-1 max-h-40 overflow-y-auto">
                  {result.invalid.map((row) => (
                    <li key={row.row}>
                      {row.row}行目: {row.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}