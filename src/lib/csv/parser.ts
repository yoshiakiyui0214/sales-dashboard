import Papa from "papaparse";
import { z } from "zod";

// "Order Date" → "order_date" のような列名のゆらぎを吸収する
function normalizeHeader(header: string): string {
  const map: Record<string, string> = {
    "order date": "order_date",
    "customer id": "customer_id",
    "product name": "product_name",
    category: "category",
    sku: "sku",
    quantity: "quantity",
    revenue: "revenue",
    cost: "cost",
  };
  const key = header.trim().toLowerCase();
  return map[key] ?? header.trim().toLowerCase().replace(/\s+/g, "_");
}

/**
 * "2025-09-03" / "2025/09/03" / "2025/9/3" を "2025-09-03" に揃える。
 * 形式が違う、または存在しない日付（2月30日など）の場合は null。
 */
export function normalizeDate(value: string): string | null {
  const match = value.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  // 実在する日付かを確認（2025-02-30 などを弾く）
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const SaleRowSchema = z.object({
  order_date: z
    .string()
    .trim()
    .min(1, "日付が空です")
    .transform((value, ctx) => {
      const normalized = normalizeDate(value);
      if (!normalized) {
        ctx.addIssue({
          code: "custom",
          message: "日付は YYYY-MM-DD または YYYY/MM/DD の形式で、実在する日付にしてください",
        });
        return z.NEVER;
      }
      return normalized;
    }),
  customer_id: z.string().trim().min(1, "顧客IDが空です"),
  product_name: z.string().trim().min(1, "商品名が空です"),
  // 空欄は undefined にして、集計時に「未分類」として扱う
  category: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    }),
  sku: z.string().trim().min(1, "SKUが空です"),
  quantity: z.coerce.number().int().positive("数量は正の整数にしてください"),
  revenue: z.coerce.number().nonnegative("売上は0以上にしてください"),
  cost: z.coerce.number().nonnegative("原価は0以上にしてください"),
});

export type SaleRow = z.infer<typeof SaleRowSchema>;

export interface InvalidRow {
  row: number;
  reason: string;
}

export interface ParseResult {
  valid: SaleRow[];
  invalid: InvalidRow[];
  totalRows: number;
}

export async function parseSalesCsv(file: File): Promise<ParseResult> {
  const text = await file.text();

  const { data } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  });

  const valid: SaleRow[] = [];
  const invalid: InvalidRow[] = [];

  data.forEach((row, i) => {
    const result = SaleRowSchema.safeParse(row);
    if (result.success) {
      valid.push(result.data);
    } else {
      const reason = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      invalid.push({ row: i + 2, reason }); // +2 = ヘッダー行 + 1始まり
    }
  });

  return { valid, invalid, totalRows: data.length };
}