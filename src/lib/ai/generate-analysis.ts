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
          content: `今月の売上KPIサマリー:\n${JSON.stringify(kpiSummary, null, 2)}`,
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