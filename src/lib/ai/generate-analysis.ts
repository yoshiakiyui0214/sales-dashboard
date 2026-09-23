import Anthropic from "@anthropic-ai/sdk";
import type { KpiSummary } from "@/lib/analytics/kpi";
import { ANALYSIS_SYSTEM_PROMPT } from "@/lib/ai/analysis-prompt";

export type AnalysisResult = {
  summary: string;
  actions: string[];
};

/**
 * レスポンステキストからJSON部分だけを安全に取り出す。
 * Claudeが前後に余計なテキストを付けてしまった場合の保険。
 */
export function extractJson(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("AI応答からJSONを抽出できませんでした");
  }
  return text.slice(start, end + 1);
}

export function isValidAnalysisResult(
  data: unknown
): data is AnalysisResult {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.summary === "string" &&
    Array.isArray(d.actions) &&
    d.actions.every((a) => typeof a === "string")
  );
}

/**
 * KPIサマリーをAIに渡すメッセージを組み立てる。
 * 「単月の数字」と「期間全体の数字」が混ざらないよう、各項目の意味を明記する。
 */
export function buildAnalysisUserMessage(kpiSummary: KpiSummary): string {
  const months = kpiSummary.monthlyData.map((m) => m.month);
  const firstMonth = months[0] ?? "不明";
  const latestMonth = kpiSummary.latestMonth?.month ?? "不明";
  const previousMonth = kpiSummary.previousMonth?.month ?? "なし";

  return [
    "以下はアパレルECの売上KPIサマリー(JSON)です。",
    "",
    "## 期間の前提",
    `- データ期間: ${firstMonth} 〜 ${latestMonth}`,
    `- 分析の対象月(最新月): ${latestMonth}`,
    `- 比較対象の前月: ${previousMonth}`,
    "",
    "## 各項目の意味",
    "- latestMonth / previousMonth: 最新月と前月の単月の数字",
    "- revenueMomChange / grossProfitMomChange: 最新月の前月比(%)",
    "- repeatRateMomDiff: 最新月のリピート率の前月差(ポイント)",
    "- 月次リピート率: その月に購入した顧客のうち、その月末までに累計2回以上購入している顧客の割合",
    "- totalRevenue / totalGrossProfit / grossProfitMargin / repeatRate: データ期間全体の累計・平均",
    "- monthlyData: 月ごとの推移",
    "- categoryRanking / skuRanking: データ期間全体の集計",
    "",
    "## 注意",
    "- 「今月」と書くときは最新月の単月の数字を使い、期間全体の累計と混同しないこと",
    "- 期間全体の数字に触れるときは「期間累計」「期間全体」と明記すること",
    "",
    "## KPIサマリー",
    JSON.stringify(kpiSummary, null, 2),
  ].join("\n");
}

/**
 * KPIサマリーをもとにClaude APIへ分析を依頼し、
 * パース・バリデーション済みの結果を返す。
 */
export async function generateAnalysis(
  kpiSummary: KpiSummary
): Promise<AnalysisResult> {
  const client = new Anthropic();

  let responseText: string;
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildAnalysisUserMessage(kpiSummary),
        },
      ],
    });

    const block = response.content[0];
    if (block.type !== "text") {
      throw new Error("AIからテキスト応答が得られませんでした");
    }
    responseText = block.text;
  } catch (err) {
    throw new Error(
      `Claude API呼び出しに失敗しました: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let analysis: AnalysisResult;
  try {
    const parsed = JSON.parse(extractJson(responseText));
    if (!isValidAnalysisResult(parsed)) {
      throw new Error("AI応答のJSON構造が想定と異なります");
    }
    analysis = parsed;
  } catch (err) {
    throw new Error(
      `AI応答の解析に失敗しました: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return analysis;
}