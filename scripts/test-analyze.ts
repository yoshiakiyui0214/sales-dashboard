import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { analyzeReport } from "../src/actions/analyze";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "環境変数が設定されていません(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY を確認してください)"
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

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

  const uploadId = uploads[0].id;
  console.log(`対象アップロードID: ${uploadId}`);
  console.log("AI分析を実行中...");

  const result = await analyzeReport(uploadId);

  console.log("=== 分析結果 ===");
  console.log("サマリー:", result.summary);
  console.log("アクション提案:");
  result.actions.forEach((action, i) => {
    console.log(`  ${i + 1}. ${action}`);
  });
}

main()
  .then(() => {
    console.log("テスト成功");
    process.exit(0);
  })
  .catch((err) => {
    console.error("テスト失敗:", err);
    process.exit(1);
  });