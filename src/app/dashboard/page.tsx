import { createClient } from "@/lib/supabase/server";
import { calculateKpi, type SalesRecord } from "@/lib/analytics/kpi";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { AiAnalysis } from "@/components/dashboard/ai-analysis";

function KpiCard({
  label,
  value,
  momChange,
}: {
  label: string;
  value: string;
  momChange?: number | null;
}) {
  return (
    <div className="bg-white rounded-lg border-l-4 border-l-brand-navy shadow-sm p-6">
      <p className="text-sm text-zinc-600">{label}</p>
      <p className="text-3xl font-bold text-brand-navy mt-1">{value}</p>
      {momChange !== undefined && momChange !== null && (
        <p
          className={`text-sm mt-1 ${
            momChange >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          前月比 {momChange >= 0 ? "+" : ""}
          {momChange.toFixed(1)}%
        </p>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sales_data")
    .select("order_date, customer_id, product_name, category, sku, quantity, revenue, cost");

  if (error) {
    return (
      <main className="min-h-screen bg-brand-light p-8">
        <p className="text-red-600">データの取得に失敗しました: {error.message}</p>
      </main>
    );
  }

  const records = (data ?? []) as SalesRecord[];

  if (records.length === 0) {
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

  const kpi = calculateKpi(records);

  return (
    <main className="min-h-screen bg-brand-light p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-brand-navy mb-6">
          売上分析ダッシュボード
        </h1>

        {/* 3大KPIカード */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <KpiCard
            label="売上"
            value={`¥${kpi.totalRevenue.toLocaleString()}`}
            momChange={kpi.revenueMomChange}
          />
          <KpiCard
            label="粗利"
            value={`¥${kpi.totalGrossProfit.toLocaleString()}`}
          />
          <KpiCard
            label="リピート率"
            value={`${kpi.repeatRate.toFixed(1)}%`}
          />
        </div>

        {/* 月次推移グラフ */}
        <div className="bg-white rounded-lg border p-6 mb-8">
          <h2 className="font-semibold text-brand-navy mb-4">月次売上推移</h2>
         <RevenueChart data={kpi.monthlyData} />
        </div>

        {/* カテゴリ別売上 */}
        <div className="bg-white rounded-lg border p-6 mb-8">
          <h2 className="font-semibold text-brand-navy mb-4">カテゴリ別売上</h2>
          <ul className="space-y-2">
            {kpi.categoryRanking.map((c) => (
              <li
                key={c.category}
                className="flex justify-between text-sm border-b pb-2"
              >
                <span>{c.category}</span>
                <span className="font-semibold">
                  ¥{c.revenue.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* SKUトップ10 */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="font-semibold text-brand-navy mb-4">
            SKUトップ10(数量ベース)
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
        </div>
        <AiAnalysis />
     </main>
  );
}