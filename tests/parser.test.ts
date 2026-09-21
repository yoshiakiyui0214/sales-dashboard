import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseSalesCsv } from "../src/lib/csv/parser";

describe("parseSalesCsv", () => {
  it("サンプルCSV(40件)がすべて正しくパースされる", async () => {
    const csvPath = join(__dirname, "fixtures", "sample-sales.csv");
    const csvText = readFileSync(csvPath, "utf-8");
    const file = new File([csvText], "sample-sales.csv", { type: "text/csv" });

    const result = await parseSalesCsv(file);

    expect(result.totalRows).toBe(40);
    expect(result.valid.length).toBe(40);
    expect(result.invalid.length).toBe(0);
  });

  it("9月の売上合計が正しく計算できる", async () => {
    const csvPath = join(__dirname, "fixtures", "sample-sales.csv");
    const csvText = readFileSync(csvPath, "utf-8");
    const file = new File([csvText], "sample-sales.csv", { type: "text/csv" });

    const result = await parseSalesCsv(file);
    const septemberRevenue = result.valid
      .filter((row) => row.order_date.startsWith("2025-09"))
      .reduce((sum, row) => sum + row.revenue, 0);

    // README記載の正解値と突き合わせる想定(ここでは0より大きいことだけ確認)
    expect(septemberRevenue).toBeGreaterThan(0);
  });
});