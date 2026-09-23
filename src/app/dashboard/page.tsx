import { createClient } from "@/lib/supabase/server";
import { calculateKpi, type SalesRecord } from "@/lib/analytics/kpi";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { AiAnalysis } from "@/components/dashboard/ai-analysis";

/** "2025-11" → "2025年11月" */
function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  return `${year}年${Number(m)}月`;
}

function formatYen(value: number): string {
  return `¥${Math.round(value).toLocaleString()}`;
}

type Change = { text: string; isPositive: boolean } | null;

/** 売上・粗利用: 前月比（%） */
function toPercentChange(value: number | null): Change {
  if (value === null) return null;
  return {
    text: `前月比 ${value >= 0 ? "+" : ""}${value.toFixed(1)}%`,
    isPositive: value >= 0,
  };
}

/** リピート率用: 前月差（ポイント） */
function toPointChange(value: number | null): Change {
  if (value === null) return null;
  return {
    text: `前月差 ${value >= 0 ? "+" : ""}${value.toFixed(1)}pt`,
    isPositive: value >= 0,
  };
}

function KpiCard({
  label,
  value,
  change,
  note,
}: {
  label: string;
  value: string;
  change: Change;
  note?: string;
}) {
  return (
    <div className="bg-white rounded-lg border-l-4 border-l-brand-navy shadow-sm p-6">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="text-3xl font-bold text-brand-navy mt-1">{value}</p>
      {change ? (
        <p
          className={`text-sm mt-1 ${
            change.isPositive ? "text-green-600" : "text-red-600"
          }`}
        >
          {change.text}
        </p>
      ) : (
        <p className="text-sm mt-1 text-zinc-400">前月データなし</p>
      )}
      {note && <p className="text-xs text-zinc-500 mt-3">{note}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data, error, count } = await supabase
    .from("sales_data")
    .select(
      "order_date, customer_id, product_name, category, sku, quantity, revenue, cost",
      { count: "exact" }
    );

  if (error) {
    return (
      <main className="min-h-screen bg-brand-light p-8">
        <p className="text-red-600">
          データの取得に失敗しました: {error.message}
        </p>
      </main>
    );
  }

  const records = (data ?? []) as SalesRecord[];
  const kpi = calculateKpi(records);
  const latest = kpi.latestMonth;
  const previous = kpi.previousMonth;

  if (records.length === 0 || !latest) {
    return (
      <main className="min-h-screen bg-brand-light p-8">
        <h1 className="text-2xl font-bold text-brand-navy mb-4">
          売上分析ダッシュボード
        </h1>
        <p className="text-zinc-600">
          まだデータがありません。先に
          <a href="/upload" className="text-brand-navy underline mx-1">
            CSVをアップロード
          </a>
          してください。
        </p>
      </main>
    );
  }

  // 取得できた件数がDB上の件数より少ない = 集計が欠けている
  const isTruncated = count !== null && count > records.length;

  const firstMonth = kpi.monthlyData[0].month;
  const periodLabel =
    firstMonth === latest.month
      ? formatMonth(latest.month)
      : `${formatMonth(firstMonth)}〜${formatMonth(latest.month)}`;

  return (
    <main className="min-h-screen bg-brand-light p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-brand-navy mb-2">
          売上分析ダッシュボード
        </h1>
        <p className="text-sm text-zinc-600 mb-6">
          対象月:
          <span className="font-semibold text-brand-navy">
            {formatMonth(latest.month)}
          </span>
          {previous && `（${formatMonth(previous.month)}との比較）`}
          <span className="mx-2">|</span>
          データ期間:{periodLabel}
        </p>

        {isTruncated && (
          <div className="bg-red-50 border border-red-300 text-red-700 text-sm rounded-lg p-4 mb-6">
            データ件数が多いため、全{count?.toLocaleString()}件中
            {records.length.toLocaleString()}
            件しか集計できていません。表示中の数字は正確ではありません。管理者に連絡してください。
          </div>
        )}

        {/* 3大KPIカード（最新月の数字） */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3">
          <KpiCard
            label={`売上（${formatMonth(latest.month)}）`}
            value={formatYen(latest.revenue)}
            change={toPercentChange(kpi.revenueMomChange)}
            note={`期間累計 ${formatYen(kpi.totalRevenue)}`}
          />
          <KpiCard
            label={`粗利（${formatMonth(latest.month)}）`}
            value={formatYen(latest.grossProfit)}
            change={toPercentChange(kpi.grossProfitMomChange)}
            note={`粗利率 ${latest.grossProfitMargin.toFixed(1)}%｜期間累計 ${formatYen(
              kpi.totalGrossProfit
            )}`}
          />
          <KpiCard
            label={`リピート率（${formatMonth(latest.month)}）`}
            value={`${latest.repeatRate.toFixed(1)}%`}
            change={toPointChange(kpi.repeatRateMomDiff)}
            note={`期間全体 ${kpi.repeatRate.toFixed(1)}%`}
          />
        </div>
        <p className="text-xs text-zinc-500 mb-8">
          ※ リピート率(月次)= その月に購入した顧客のうち、その月末までに累計2回以上購入している顧客の割合
        </p>

        {/* 月次推移グラフ */}
        <div className="bg-white rounded-lg border p-6 mb-8">
          <h2 className="font-semibold text-brand-navy mb-4">月次売上推移</h2>
          <RevenueChart data={kpi.monthlyData} />
        </div>

        {/* カテゴリ別売上 */}
        <div className="bg-white rounded-lg border p-6 mb-8">
          <h2 className="font-semibold text-brand-navy mb-4">
            カテゴリ別売上（{periodLabel}）
          </h2>
          <ul className="space-y-2">
            {kpi.categoryRanking.map((c) => (
              <li
                key={c.category}
                className="flex justify-between text-sm border-b pb-2"
              >
                <span>{c.category}</span>
                <span className="font-semibold">{formatYen(c.revenue)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* SKUトップ10 */}
        <div className="bg-white rounded-lg border p-6 mb-8">
          <h2 className="font-semibold text-brand-navy mb-4">
            SKUトップ10(数量ベース・{periodLabel})
          </h2>
          <ul className="space-y-2">
            {kpi.skuRanking.map((s, i) => (
              <li
                key={s.sku}
                className="flex justify-between text-sm border-b pb-2"
              >
                <span>
                  {i + 1}. {s.productName}({s.sku})
                </span>
                <span className="font-semibold">{s.quantity}個</span>
              </li>
            ))}
          </ul>
        </div>

        {/* AI分析 */}
        <AiAnalysis />
      </div>
    </main>
  );
}