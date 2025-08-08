import { useState, useMemo } from "react";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fitLinearRegression, rmse } from "@/lib/linearRegression";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

interface Point { date: string; close: number }

function genSampleData(days = 120): Point[] {
  const start = new Date();
  start.setDate(start.getDate() - days);
  const data: Point[] = [];
  let base = 100;
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    base += Math.sin(i / 8) * 0.8 + (Math.random() - 0.5) * 1.2 + 0.15; // trend + noise
    data.push({ date: d.toISOString().slice(0, 10), close: Math.max(1, +base.toFixed(2)) });
  }
  return data;
}

function parseCSV(text: string): Point[] {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].toLowerCase();
  let dateIdx = -1, closeIdx = -1;
  const headers = header.split(/,|;|\t/).map((h) => h.trim());
  headers.forEach((h, i) => {
    if (h.includes("date")) dateIdx = i;
    if (h.includes("close") || h.includes("price")) closeIdx = i;
  });
  const res: Point[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/,|;|\t/);
    const date = parts[dateIdx]?.trim();
    const close = parseFloat(parts[closeIdx]);
    if (date && !isNaN(close)) res.push({ date, close });
  }
  return res.sort((a, b) => a.date.localeCompare(b.date));
}

const StockPredictor = () => {
  const [data, setData] = useState<Point[]>(genSampleData());
  const [forecastDays, setForecastDays] = useState(30);

  const { chartData, metric } = useMemo(() => {
    if (!data.length) return { chartData: [], metric: null as number | null };
    const x = data.map((_, i) => i);
    const y = data.map((p) => p.close);
    const model = fitLinearRegression(x, y);
    const predicted = x.map((xi) => +model.predict(xi).toFixed(2));

    // Test error on last 20%
    const split = Math.floor(data.length * 0.8);
    const rmseVal = rmse(y.slice(split), predicted.slice(split));

    // Future
    const lastIdx = x[x.length - 1] ?? 0;
    const lastDate = new Date(data[data.length - 1].date);
    const futurePoints: Point[] = [];
    for (let i = 1; i <= forecastDays; i++) {
      const d = new Date(lastDate);
      d.setDate(lastDate.getDate() + i);
      futurePoints.push({
        date: d.toISOString().slice(0, 10),
        close: +model.predict(lastIdx + i).toFixed(2),
      });
    }

    const merged = [
      ...data.map((p, i) => ({ date: p.date, actual: p.close, predicted: predicted[i] })),
      ...futurePoints.map((p) => ({ date: p.date, actual: undefined, predicted: p.close })),
    ];

    return { chartData: merged, metric: rmseVal };
  }, [data, forecastDays]);

  const onFile = async (f: File | null) => {
    if (!f) return;
    const text = await f.text();
    const parsed = parseCSV(text);
    setData(parsed);
  };

  return (
    <>
      <Seo
        title="Stock Price Predictor — Linear Regression"
        description="Upload CSV or use sample data to fit a linear regression and forecast future stock prices with an interactive chart."
      />
      <main className="min-h-screen bg-background">
        <header className="container mx-auto px-6 pt-10 pb-4">
          <h1 className="text-3xl md:text-4xl font-bold">Stock Price Predictor</h1>
          <p className="text-muted-foreground max-w-2xl mt-2">
            Linear regression on historical closing prices with simple forecasting.
          </p>
        </header>

        <section className="container mx-auto px-6 pb-12 grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Data & Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm">Upload CSV (date, close)</label>
                <Input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm">Forecast days</label>
                <Input
                  type="number"
                  value={forecastDays}
                  min={1}
                  max={180}
                  onChange={(e) => setForecastDays(Math.max(1, Math.min(180, Number(e.target.value))))}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setData(genSampleData())}>Load sample</Button>
                <Button variant="ghost" onClick={() => setData([])}>Clear</Button>
              </div>
              {typeof metric === "number" && (
                <p className="text-sm text-muted-foreground">RMSE on last 20%: {metric.toFixed(3)}</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Forecast Chart</CardTitle>
            </CardHeader>
            <CardContent style={{ height: 420 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                  <XAxis dataKey="date" hide={false} tick={{ fontSize: 12 }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="actual" stroke="hsl(var(--foreground))" dot={false} name="Actual" />
                  <Line type="monotone" dataKey="predicted" stroke="hsl(var(--brand))" dot={false} name="Predicted" strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
};

export default StockPredictor;
