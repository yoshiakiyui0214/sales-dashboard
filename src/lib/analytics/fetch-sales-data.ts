import { createClient } from "@/lib/supabase/server";
import type { SalesRecord } from "@/lib/analytics/kpi";

/** Supabase が1回で返せる最大行数（デフォルト1,000） */
const PAGE_SIZE = 1000;
/** 念のための上限（1,000行 × 500回 = 50万行） */
const MAX_PAGES = 500;

const COLUMNS =
  "order_date, customer_id, product_name, category, sku, quantity, revenue, cost";

export interface FetchSalesResult {
  records: SalesRecord[];
  /** DB上の総件数（取得できなかった場合は null） */
  totalCount: number | null;
  error: string | null;
}

/**
 * sales_data を id 順に1,000件ずつ取得し、全件を返す。
 * 1回の取得では最大1,000件までしか返らないため、ページを分けて最後まで読む。
 */
export async function fetchAllSalesData(): Promise<FetchSalesResult> {
  const supabase = await createClient();
  const records: SalesRecord[] = [];
  let totalCount: number | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from("sales_data")
      .select(COLUMNS, { count: "exact" })
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      return { records, totalCount, error: error.message };
    }

    if (page === 0) {
      totalCount = count ?? null;
    }

    const rows = (data ?? []) as SalesRecord[];
    records.push(...rows);

    // 1件も返らなかった、または総件数に達したら終了
    if (rows.length === 0) break;
    if (totalCount !== null && records.length >= totalCount) break;
  }

  return { records, totalCount, error: null };
}