import { describe, it, expect } from "vitest";
import { parseSalesCsv, normalizeDate } from "@/lib/csv/parser";

const HEADER =
  "order_date,customer_id,product_name,category,sku,quantity,revenue,cost";

function toCsvFile(...rows: string[]): File {
  return new File([[HEADER, ...rows].join("\n")], "test.csv", {
    type: "text/csv",
  });
}

describe("normalizeDate", () => {
  it("ハイフン・スラッシュ・ゼロ埋めなしを YYYY-MM-DD に揃える", () => {
    expect(normalizeDate("2025-09-03")).toBe("2025-09-03");
    expect(normalizeDate("2025/09/03")).toBe("2025-09-03");
    expect(normalizeDate("2025/9/3")).toBe("2025-09-03");
  });

  it("存在しない日付や形式違いは null", () => {
    expect(normalizeDate("2025-02-30")).toBeNull();
    expect(normalizeDate("2025/13/01")).toBeNull();
    expect(normalizeDate("09/03/2025")).toBeNull();
    expect(normalizeDate("不明")).toBeNull();
  });
});

describe("parseSalesCsv の正規化", () => {
  it("日付の形式を揃えて取り込む", async () => {
    const result = await parseSalesCsv(
      toCsvFile("2025/9/3,C001,Tシャツ,トップス,SKU-1,1,1000,400")
    );
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].order_date).toBe("2025-09-03");
  });

  it("不正な日付の行だけスキップし、他の行は取り込む", async () => {
    const result = await parseSalesCsv(
      toCsvFile(
        "2025-09-03,C001,Tシャツ,トップス,SKU-1,1,1000,400",
        "2025-02-30,C002,Tシャツ,トップス,SKU-1,1,1000,400"
      )
    );
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].row).toBe(3);
  });

  it("カテゴリが空欄なら undefined（集計時に未分類）にする", async () => {
    const result = await parseSalesCsv(
      toCsvFile("2025-09-03,C001,Tシャツ,,SKU-1,1,1000,400")
    );
    expect(result.valid[0].category).toBeUndefined();
  });

  it("顧客IDなどの前後の空白を取り除く", async () => {
    const result = await parseSalesCsv(
      toCsvFile("2025-09-03, C001 ,Tシャツ,トップス,SKU-1,1,1000,400")
    );
    expect(result.valid[0].customer_id).toBe("C001");
  });
});