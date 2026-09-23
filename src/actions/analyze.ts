"use server";

import { createClient } from "@/lib/supabase/server";
import { calculateKpi } from "@/lib/analytics/kpi";
import { fetchAllSalesData } from "@/lib/analytics/fetch-sales-data";
import { generateAnalysis } from "@/lib/ai/generate-analysis";

/**
 * 登録済みの全売上データをもとにAI分析を行い、reports テーブルに保存する。
 * ダッシュボードと同じ fetchAllSalesData() を使うことで、
 * 画面の数字とAIに渡す数字が必ず一致するようにしている。
 *
 * @param uploadId 分析時点の最新アップロードID（reports に記録用）
 */
export async function analyzeReport(uploadId: string) {
  // 1. ダッシュボードと同じ方法で全売上データを取得
  const { records, totalCount, error: fetchError } = await fetchAllSalesData();

  if (fetchError) {
    throw new Error(`売上データの取得に失敗しました: ${fetchError}`);
  }
  if (records.length === 0) {
    throw new Error("売上データがありません。先にCSVアップロードを行ってください。");
  }
  if (totalCount !== null && totalCount > records.length) {
    throw new Error(
      `全${totalCount}件中${records.length}件しか取得できなかったため、分析を中止しました。`
    );
  }

  // 2. 既存のKPI計算ロジックでサマリーを算出
  const kpiSummary = calculateKpi(records);

  // 3. Claude APIに分析依頼
  const analysis = await generateAnalysis(kpiSummary);

  // 4. reportsテーブルに保存
  const supabase = await createClient();
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
 * 最新のアップロードIDを取得して分析する（ダッシュボードのボタンから呼び出す用）
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