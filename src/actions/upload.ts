"use server";

import { createClient } from "@/lib/supabase/server";
import { parseSalesCsv, type ParseResult } from "@/lib/csv/parser";
import { getMonthKey } from "@/lib/analytics/kpi";

export interface SaveResult {
  success: boolean;
  uploadId?: string;
  parseResult?: ParseResult;
  /** CSVに含まれていた月（"2025-11" 形式） */
  targetMonths?: string[];
  /** 置き換えで削除した古い行数 */
  replacedCount?: number;
  error?: string;
}

/** "2025-11" → { start: "2025-11-01", end: "2025-12-01" } */
function getMonthRange(month: string): { start: string; end: string } {
  const [year, m] = month.split("-").map(Number);
  const nextYear = m === 12 ? year + 1 : year;
  const nextMonth = m === 12 ? 1 : m + 1;
  return {
    start: `${year}-${String(m).padStart(2, "0")}-01`,
    end: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}

export async function uploadAndSaveCsv(
  formData: FormData
): Promise<SaveResult> {
  const file = formData.get("file") as File | null;
  if (!file) {
    return { success: false, error: "ファイルが選択されていません" };
  }

  const parseResult = await parseSalesCsv(file);

  if (parseResult.valid.length === 0) {
    return {
      success: false,
      parseResult,
      error: "有効な行が1件もありませんでした",
    };
  }

  // CSVに含まれる月の一覧（この月のデータを置き換える）
  const targetMonths = Array.from(
    new Set(parseResult.valid.map((row) => getMonthKey(row.order_date)))
  ).sort();

  const supabase = await createClient();

  // 1. uploads テーブルに記録を作成
  const { data: upload, error: uploadError } = await supabase
    .from("uploads")
    .insert({
      filename: file.name,
      row_count: parseResult.valid.length,
    })
    .select()
    .single();

  if (uploadError || !upload) {
    return {
      success: false,
      parseResult,
      error: `アップロード記録の作成に失敗しました: ${uploadError?.message}`,
    };
  }

  // 2. 新しい明細を先に保存（失敗したら古いデータには触らない）
  const rows = parseResult.valid.map((row) => ({
    upload_id: upload.id,
    order_date: row.order_date,
    customer_id: row.customer_id,
    product_name: row.product_name,
    category: row.category ?? null,
    sku: row.sku,
    quantity: row.quantity,
    revenue: row.revenue,
    cost: row.cost,
  }));

  const { error: insertError } = await supabase
    .from("sales_data")
    .insert(rows);

  if (insertError) {
    // 中身のないアップロード記録を残さない
    await supabase.from("uploads").delete().eq("id", upload.id);
    return {
      success: false,
      parseResult,
      error: `売上データの保存に失敗しました（既存データは変更していません）: ${insertError.message}`,
    };
  }

  // 3. 同じ月の古いデータを削除（今回のアップロード分は残す）
  let replacedCount = 0;
  for (const month of targetMonths) {
    const { start, end } = getMonthRange(month);
    const { data: deleted, error: deleteError } = await supabase
      .from("sales_data")
      .delete()
      .gte("order_date", start)
      .lt("order_date", end)
      .neq("upload_id", upload.id)
      .select("upload_id");

    if (deleteError) {
      return {
        success: false,
        parseResult,
        targetMonths,
        error: `新しいデータは保存しましたが、${month} の古いデータの削除に失敗しました。売上が二重に計上されている可能性があります。管理者に連絡してください: ${deleteError.message}`,
      };
    }
    replacedCount += deleted?.length ?? 0;
  }

  // 4. 古いデータが本当に残っていないか数え直す
  //   （権限設定で削除が許可されていないと、エラーなしで0件削除になるため）
  for (const month of targetMonths) {
    const { start, end } = getMonthRange(month);
    const { count, error: countError } = await supabase
      .from("sales_data")
      .select("upload_id", { count: "exact", head: true })
      .gte("order_date", start)
      .lt("order_date", end)
      .neq("upload_id", upload.id);

    if (countError || (count ?? 0) > 0) {
      return {
        success: false,
        parseResult,
        targetMonths,
        error: `${month} に古いデータが残っており、売上が二重に計上されています。管理者に連絡してください。${
          countError ? `(${countError.message})` : ""
        }`,
      };
    }
  }

  return {
    success: true,
    uploadId: upload.id,
    parseResult,
    targetMonths,
    replacedCount,
  };
}