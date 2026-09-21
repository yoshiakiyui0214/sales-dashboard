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

const SaleRowSchema = z.object({
  order_date: z.string().min(1, "日付が空です"),
  customer_id: z.string().min(1, "顧客IDが空です"),
  product_name: z.string().min(1, "商品名が空です"),
  category: z.string().optional(),
  sku: z.string().min(1, "SKUが空です"),
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