"use server";

import { createClient } from "@/lib/supabase/server";
import { calculateKpi, type SalesRecord } from "@/lib/analytics/kpi";
import { generateAnalysis } from "@/lib/ai/generate-analysis";

export async function analyzeReport(uploadId: string) {
  const supabase = await createClient();

  // 1. 対象アップロードの売上明細を取得
  const { data, error: fetchError } = await supabase
    .from("sales_data")
    .select(
      "order_date, customer_id, product_name, category, sku, quantity, revenue, cost"
    )
    .eq("upload_id", uploadId);

  if (fetchError) {
    throw new Error(`売上データの取得に失敗しました: ${fetchError.message}`);
  }
  if (!data || data.length === 0) {
    throw new Error("対象の売上データが見つかりません");
  }

  const records = data as SalesRecord[];

  // 2. 既存のKPI計算ロジックでサマリーを算出
  const kpiSummary = calculateKpi(records);

  // 3. Claude APIに分析依頼(切り出したロジックを呼び出すだけ)
  const analysis = await generateAnalysis(kpiSummary);

  // 4. reportsテーブルに保存
  const { error: insertError } = await supabase.from("reports").insert({
    upload_id: uploadId,
    summary: analysis.summary,
    action_items: JSON.stringify(analysis.actions),
  });

  if (insertError) {
    throw new Error(`分析結果の保存に失敗しました: ${insertError.message}`);
  }

  return analysis;
}

/**
 * 最新のアップロードを自動取得して分析する(ダッシュボードのボタンから呼び出す用)
 */
export async function analyzeLatestReport() {
  const supabase = await createClient();

  const { data: uploads, error } = await supabase
    .from("uploads")
    .select("id, uploaded_at")
    .order("uploaded_at", { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`uploadsテーブルの取得に失敗しました: ${error.message}`);
  }
  if (!uploads || uploads.length === 0) {
    throw new Error(
      "uploadsテーブルにデータがありません。先にCSVアップロードを行ってください。"
    );
  }

  return await analyzeReport(uploads[0].id);
}