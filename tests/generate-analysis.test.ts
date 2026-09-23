import { describe, it, expect, vi, beforeEach } from "vitest";
import type { KpiSummary } from "@/lib/analytics/kpi";

// Anthropic SDKをモック化し、固定のレスポンスを返すようにする
const mockCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = {
      create: mockCreate,
    };
  }
  return {
    default: MockAnthropic,
  };
});

// モック設定後にインポート(vi.mockはホイスティングされるため順序はこれでOK)
import { generateAnalysis } from "@/lib/ai/generate-analysis";

const sampleKpiSummary: KpiSummary = {
  totalRevenue: 560600,
  totalGrossProfit: 349100,
  grossProfitMargin: 62.3,
  repeatRate: 28.6,
  monthlyData: [
    {
      month: "2025-11",
      revenue: 264700,
      grossProfit: 165000,
      grossProfitMargin: 62.3,
      orderCount: 18,
      customerCount: 16,
      repeatCustomerCount: 6,
      repeatRate: 37.5,
    },
  ],
  latestMonth: {
    month: "2025-11",
    revenue: 264700,
    grossProfit: 165000,
    grossProfitMargin: 62.3,
    orderCount: 18,
    customerCount: 16,
    repeatCustomerCount: 6,
    repeatRate: 37.5,
  },
  previousMonth: null,
  revenueMomChange: null,
  grossProfitMomChange: null,
  repeatRateMomDiff: null,
  categoryRanking: [{ category: "アウター", revenue: 287400 }],
  skuRanking: [
    {
      sku: "LUM-TOP-01",
      productName: "オーガニックコットンTシャツ",
      quantity: 14,
      revenue: 42000,
    },
  ],
};

function mockClaudeResponse(text: string) {
  mockCreate.mockResolvedValue({
    content: [{ type: "text", text }],
  });
}

describe("generateAnalysis", () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("正常なJSON応答を正しくパースする(Snapshot)", async () => {
    mockClaudeResponse(
      JSON.stringify({
        summary: "3ヶ月累計売上は560,600円、粗利率62.3%と高水準を維持しています。",
        actions: [
          "アウターの在庫確保を強化してください。",
          "リピート率改善施策を実施してください。",
        ],
      })
    );

    const result = await generateAnalysis(sampleKpiSummary);

    expect(result).toMatchSnapshot();
  });

  it("前後に余計なテキストが付いていてもJSON部分だけ抽出できる", async () => {
    mockClaudeResponse(
      `分析結果は以下の通りです:\n\n{"summary": "テストサマリー", "actions": ["アクション1"]}\n\n以上です。`
    );

    const result = await generateAnalysis(sampleKpiSummary);

    expect(result.summary).toBe("テストサマリー");
    expect(result.actions).toEqual(["アクション1"]);
  });

  it("JSON構造が不正な場合はエラーを投げる", async () => {
    mockClaudeResponse(
      JSON.stringify({
        summary: "サマリーのみで actions がない不正なレスポンス",
      })
    );

    await expect(generateAnalysis(sampleKpiSummary)).rejects.toThrow(
      "AI応答の解析に失敗しました"
    );
  });

  it("JSONとして解析できない応答の場合はエラーを投げる", async () => {
    mockClaudeResponse("これはJSONではないただの文章です。");

    await expect(generateAnalysis(sampleKpiSummary)).rejects.toThrow(
      "AI応答の解析に失敗しました"
    );
  });

  it("actions配列の要素が文字列でない場合はエラーを投げる", async () => {
    mockClaudeResponse(
      JSON.stringify({
        summary: "テスト",
        actions: [123, 456],
      })
    );

    await expect(generateAnalysis(sampleKpiSummary)).rejects.toThrow(
      "AI応答の解析に失敗しました"
    );
  });
});