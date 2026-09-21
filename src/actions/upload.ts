"use server";

import { createClient } from "@/lib/supabase/server";
import { parseSalesCsv, type ParseResult } from "@/lib/csv/parser";

export interface SaveResult {
  success: boolean;
  uploadId?: string;
  parseResult?: ParseResult;
  error?: string;
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

  // 2. sales_data テーブルに明細を一括登録
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
    return {
      success: false,
      parseResult,
      error: `売上データの保存に失敗しました: ${insertError.message}`,
    };
  }

  return { success: true, uploadId: upload.id, parseResult };
}