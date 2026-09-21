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
  orderCount: number;
}

export interface KpiSummary {
  totalRevenue: number;
  totalGrossProfit: number;
  grossProfitMargin: number;
  repeatRate: number;
  monthlyData: MonthlyKpi[];
  latestMonth: MonthlyKpi | null;
  previousMonth: MonthlyKpi | null;
  revenueMomChange: number | null;
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
};

type SkuAccumulator = {
  productName: string;
  quantity: number;
  revenue: number;
};

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function calculateKpi(records: SalesRecord[]): KpiSummary {
  const totalRevenue = records.reduce((sum, r) => sum + r.revenue, 0);
  const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
  const totalGrossProfit = totalRevenue - totalCost;
  const grossProfitMargin =
    totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

  const monthlyMap = new Map<string, MonthlyAccumulator>();
  for (const r of records) {
    const month = getMonthKey(r.order_date);
    const current = monthlyMap.get(month) ?? {
      revenue: 0,
      cost: 0,
      orderCount: 0,
    };
    current.revenue += r.revenue;
    current.cost += r.cost;
    current.orderCount += 1;
    monthlyMap.set(month, current);
  }

  const monthlyData: MonthlyKpi[] = Array.from(monthlyMap.entries())
    .map(([month, v]) => ({
      month,
      revenue: v.revenue,
      grossProfit: v.revenue - v.cost,
      orderCount: v.orderCount,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const latestMonth = monthlyData[monthlyData.length - 1] ?? null;
  const previousMonth = monthlyData[monthlyData.length - 2] ?? null;
  const revenueMomChange =
    latestMonth && previousMonth && previousMonth.revenue > 0
      ? ((latestMonth.revenue - previousMonth.revenue) /
          previousMonth.revenue) *
        100
      : null;

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

  const categoryMap = new Map<string, number>();
  for (const r of records) {
    const cat = r.category ?? "未分類";
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + r.revenue);
  }
  const categoryRanking = Array.from(categoryMap.entries())
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue);

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
    categoryRanking,
    skuRanking,
  };
}