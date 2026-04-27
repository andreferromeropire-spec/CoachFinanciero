import { prisma } from "@coach/db";

interface BluelyticsResponse {
  blue: { value_buy: number; value_sell: number };
  oficial: { value_buy: number; value_sell: number };
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
let cached: { data: BluelyticsResponse; at: number } | null = null;

async function fetchBluelytics(): Promise<BluelyticsResponse> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const res = await fetch("https://api.bluelytics.com.ar/v2/latest");
  if (!res.ok) throw new Error(`bluelytics ${res.status}`);
  const data = (await res.json()) as BluelyticsResponse;
  cached = { data, at: Date.now() };
  return data;
}

export async function getLatestRate() {
  const data = await fetchBluelytics();
  return {
    buyBlue: data.blue.value_buy,
    sellBlue: data.blue.value_sell,
    buyOfficial: data.oficial.value_buy,
    sellOfficial: data.oficial.value_sell,
    source: "bluelytics",
    fetchedAt: new Date().toISOString(),
  };
}

export async function snapshotRate() {
  const data = await fetchBluelytics();
  return prisma.exchangeRate.create({
    data: {
      buyBlue: data.blue.value_buy,
      sellBlue: data.blue.value_sell,
      buyOfficial: data.oficial.value_buy,
      sellOfficial: data.oficial.value_sell,
    },
  });
}

export async function getRateHistory(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return prisma.exchangeRate.findMany({
    where: { date: { gte: since } },
    orderBy: { date: "asc" },
  });
}
