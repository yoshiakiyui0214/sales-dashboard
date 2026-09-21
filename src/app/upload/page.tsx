"use client";

import { useState, useCallback } from "react";
import { parseSalesCsv, type ParseResult } from "@/lib/csv/parser";
import { uploadAndSaveCsv } from "@/actions/upload";

export default function UploadPage() {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
   type SaveStatus = "idle" | "saving" | "saved" | "error";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string>("");

  const handleFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setFileName(file.name);
    setSaveStatus("idle");
    setSaveError("");

    try {
      // 1. まずブラウザ側でパース結果をプレビュー表示
      const parsed = await parseSalesCsv(file);
      setResult(parsed);
      setIsLoading(false);

      // 2. 有効な行があれば、Server Actionでデータベースに保存
      if (parsed.valid.length > 0) {
        setSaveStatus("saving");
        const formData = new FormData();
        formData.append("file", file);
        const saveResult = await uploadAndSaveCsv(formData);

        if (saveResult.success) {
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
          setSaveError(saveResult.error ?? "不明なエラーが発生しました");
        }
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
    },
    [handleFile]
  );

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col items-center p-8">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold text-[#1A2E5C] mb-6">
          売上CSVアップロード
        </h1>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging
              ? "border-[#1A2E5C] bg-blue-50"
              : "border-zinc-300 bg-white"
          }`}
        >
          <p className="text-zinc-600 mb-4">
            CSVファイルをここにドラッグ&ドロップ、または
          </p>
          <label className="inline-block bg-[#1A2E5C] text-white px-4 py-2 rounded cursor-pointer hover:opacity-90">
            ファイルを選択
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={onFileInputChange}
            />
          </label>
        </div>

        {isLoading && <p className="mt-4 text-zinc-600">読み込み中...</p>}

        {result && !isLoading && (
          <div className="mt-6 bg-white rounded-lg border p-6">
            <p className="font-semibold text-[#1A2E5C] mb-2">{fileName}</p>
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
              <p className="mt-3 text-sm text-green-600 font-semibold">
                ✓ データベースへの保存が完了しました
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