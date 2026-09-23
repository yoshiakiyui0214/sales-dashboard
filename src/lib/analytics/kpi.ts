export interface SalesRecord {
  order_date: string;
  customer_id: string;
  product_name: string;
  category: string | null;
  sku: string;
  quantity: number;
  revenue: number;
  cost: number;
}

export interface MonthlyKpi {
  month: string;
  revenue: number;
  grossProfit: number;
  grossProfitMargin: number;
  orderCount: number;
  customerCount: number;
  repeatCustomerCount: number;
  repeatRate: number;
}

export interface KpiSummary {
  // 期間全体
  totalRevenue: number;
  totalGrossProfit: number;
  grossProfitMargin: number;
  repeatRate: number;
  // 月次
  monthlyData: MonthlyKpi[];
  latestMonth: MonthlyKpi | null;
  previousMonth: MonthlyKpi | null;
  // 前月比（売上・粗利は %、リピート率はポイント差）
  revenueMomChange: number | null;
  grossProfitMomChange: number | null;
  repeatRateMomDiff: number | null;
  // ランキング
  categoryRanking: { category: string; revenue: number }[];
  skuRanking: {
    sku: string;
    productName: string;
    quantity: number;
    revenue: number;
  }[];
}

type MonthlyAccumulator = {
  revenue: number;
  cost: number;
  orderCount: number;
  customerOrders: Map<string, number>;
};

type SkuAccumulator = {
  productName: string;
  quantity: number;
  revenue: number;
};

/**
 * "2025-11-03" / "2025/11/03" / "2025/9/3" などを "2025-11" 形式に揃える
 */
export function getMonthKey(dateStr: string): string {
  const [year, month] = dateStr.trim().split(/[-/]/);
  if (!year || !month) return dateStr.trim().slice(0, 7);
  return `${year}-${month.padStart(2, "0")}`;
}

/**
 * 変化率（%）。前の値が 0 以下のときは比較できないので null
 */
function calcChangeRate(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

export function calculateKpi(records: SalesRecord[]): KpiSummary {
  // ===== 期間全体 =====
  const totalRevenue = records.reduce((sum, r) => sum + r.revenue, 0);
  const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
  const totalGrossProfit = totalRevenue - totalCost;
  const grossProfitMargin =
    totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

  // ===== 月次の集計 =====
  const monthlyMap = new Map<string, MonthlyAccumulator>();
  for (const r of records) {
    const month = getMonthKey(r.order_date);
    const current = monthlyMap.get(month) ?? {
      revenue: 0,
      cost: 0,
      orderCount: 0,
      customerOrders: new Map<string, number>(),
    };
    current.revenue += r.revenue;
    current.cost += r.cost;
    current.orderCount += 1;
    current.customerOrders.set(
      r.customer_id,
      (current.customerOrders.get(r.customer_id) ?? 0) + 1
    );
    monthlyMap.set(month, current);
  }

  // 月を古い順に並べ、顧客ごとの累計購入回数を積み上げながら月次リピート率を出す
  const sortedMonths = Array.from(monthlyMap.keys()).sort((a, b) =>
    a.localeCompare(b)
  );
  const cumulativeOrders = new Map<string, number>();

  const monthlyData: MonthlyKpi[] = sortedMonths.map((month) => {
    const v = monthlyMap.get(month)!;

    for (const [customerId, count] of v.customerOrders) {
      cumulativeOrders.set(
        customerId,
        (cumulativeOrders.get(customerId) ?? 0) + count
      );
    }

    const customerCount = v.customerOrders.size;
    const repeatCustomerCount = Array.from(v.customerOrders.keys()).filter(
      (customerId) => (cumulativeOrders.get(customerId) ?? 0) >= 2
    ).length;

    const grossProfit = v.revenue - v.cost;

    return {
      month,
      revenue: v.revenue,
      grossProfit,
      grossProfitMargin: v.revenue > 0 ? (grossProfit / v.revenue) * 100 : 0,
      orderCount: v.orderCount,
      customerCount,
      repeatCustomerCount,
      repeatRate:
        customerCount > 0 ? (repeatCustomerCount / customerCount) * 100 : 0,
    };
  });

  const latestMonth = monthlyData[monthlyData.length - 1] ?? null;
  const previousMonth = monthlyData[monthlyData.length - 2] ?? null;

  const revenueMomChange =
    latestMonth && previousMonth
      ? calcChangeRate(latestMonth.revenue, previousMonth.revenue)
      : null;
  const grossProfitMomChange =
    latestMonth && previousMonth
      ? calcChangeRate(latestMonth.grossProfit, previousMonth.grossProfit)
      : null;
  const repeatRateMomDiff =
    latestMonth && previousMonth
      ? latestMonth.repeatRate - previousMonth.repeatRate
      : null;

  // ===== 期間全体のリピート率 =====
  const customerOrderCount = new Map<string, number>();
  for (const r of records) {
    customerOrderCount.set(
      r.customer_id,
      (customerOrderCount.get(r.customer_id) ?? 0) + 1
    );
  }
  const totalCustomers = customerOrderCount.size;
  const repeatCustomers = Array.from(customerOrderCount.values()).filter(
    (count) => count >= 2
  ).length;
  const repeatRate =
    totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

  // ===== カテゴリ別 =====
  const categoryMap = new Map<string, number>();
  for (const r of records) {
    const cat = r.category ?? "未分類";
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + r.revenue);
  }
  const categoryRanking = Array.from(categoryMap.entries())
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  // ===== SKU トップ10 =====
  const skuMap = new Map<string, SkuAccumulator>();
  for (const r of records) {
    const current = skuMap.get(r.sku) ?? {
      productName: r.product_name,
      quantity: 0,
      revenue: 0,
    };
    current.quantity += r.quantity;
    current.revenue += r.revenue;
    skuMap.set(r.sku, current);
  }
  const skuRanking = Array.from(skuMap.entries())
    .map(([sku, v]) => ({ sku, ...v }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  return {
    totalRevenue,
    totalGrossProfit,
    grossProfitMargin,
    repeatRate,
    monthlyData,
    latestMonth,
    previousMonth,
    revenueMomChange,
    grossProfitMomChange,
    repeatRateMomDiff,
    categoryRanking,
    skuRanking,
  };
}