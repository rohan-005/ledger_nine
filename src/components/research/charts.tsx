"use client";

import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as ChartTooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { ResearchScores, EvidenceItem, parseScore } from "@/src/types/frontend";
import { getFriendlySourceName } from "@/src/lib/presentation/helpers";

// SSR Guard
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-foreground-secondary">
        Loading charts...
      </div>
    );
  }
  return <>{children}</>;
}

// ─── Score Comparison Bar Chart ──────────────────────────────────────────────

export function ScoreComparisonChart({ score }: { score: ResearchScores }) {
  const data = [
    { name: "Business Quality", score: score.business !== null ? parseScore(score.business) : null, color: "#10B981" },
    { name: "Financial Health", score: score.financial !== null ? parseScore(score.financial) : null, color: "#059669" },
    { name: "Valuation", score: score.valuation !== null ? parseScore(score.valuation) : null, color: "#3B82F6" },
    { name: "News & Macro", score: score.news !== null ? parseScore(score.news) : null, color: "#8B5CF6" },
    { name: "Risk Profile", score: score.risk !== null ? parseScore(score.risk) : null, color: "#EF4444" },
  ].filter((item) => item.score !== null) as { name: string; score: number; color: string }[];

  return (
    <ClientOnly>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="name"
              stroke="#8A94A3"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#8A94A3"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
            />
            <ChartTooltip
              cursor={{ fill: "#F3F4F6" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="bg-white border border-border shadow-md rounded-lg p-2 text-xs">
                      <p className="font-semibold text-foreground">{item.name}</p>
                      <p className="text-foreground-secondary font-mono">Score: {item.score.toFixed(1)}/100</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ClientOnly>
  );
}

// ─── Evidence Source Mix Donut Chart ──────────────────────────────────────────

export function EvidenceSourceMixChart({ evidence }: { evidence: EvidenceItem[] }) {
  const counts = evidence.reduce<Record<string, number>>((acc, item) => {
    const src = item.sourceType || "unknown";
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {});

  const COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899"];

  const data = Object.entries(counts).map(([source, count], idx) => ({
    name: getFriendlySourceName(source),
    value: count,
    color: COLORS[idx % COLORS.length],
  }));

  if (data.length === 0) {
    return <p className="text-xs text-foreground-secondary py-4 text-center">No source data available</p>;
  }

  return (
    <ClientOnly>
      <div className="h-64 w-full flex flex-col justify-center">
        <ResponsiveContainer width="100%" height="90%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <ChartTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0];
                  return (
                    <div className="bg-white border border-border shadow-md rounded-lg p-2 text-xs">
                      <p className="font-semibold text-foreground">{item.name}</p>
                      <p className="text-foreground-secondary font-mono">
                        Count: {item.value} items ({((Number(item.value) / evidence.length) * 100).toFixed(0)}%)
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              align="center"
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: 10, color: "#5F6B7A" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ClientOnly>
  );
}

// ─── Evidence Category Mix Chart ──────────────────────────────────────────────

export function EvidenceCategoryMixChart({ evidence }: { evidence: EvidenceItem[] }) {
  const counts = evidence.reduce<Record<string, number>>((acc, item) => {
    const cat = item.category || "other";
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(counts).map(([category, count]) => {
    let color = "#3B82F6";
    if (category === "business") color = "#10B981";
    if (category === "financial") color = "#059669";
    if (category === "valuation") color = "#8B5CF6";
    if (category === "news") color = "#EC4899";
    if (category === "risk") color = "#EF4444";

    return {
      name: category.charAt(0).toUpperCase() + category.slice(1),
      count,
      color,
    };
  });

  if (data.length === 0) {
    return <p className="text-xs text-foreground-secondary py-4 text-center">No category data available</p>;
  }

  return (
    <ClientOnly>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <XAxis type="number" stroke="#8A94A3" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              stroke="#8A94A3"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <ChartTooltip
              cursor={{ fill: "#F9FAFB" }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="bg-white border border-border shadow-md rounded-lg p-2 text-xs">
                      <p className="font-semibold text-foreground">{item.name}</p>
                      <p className="text-foreground-secondary font-mono">Count: {item.count} items</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ClientOnly>
  );
}

// ─── Research Confidence Gauge ────────────────────────────────────────────────

export function ResearchConfidenceGauge({ confidence }: { confidence: number }) {
  const radius = 50;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, confidence)) / 100) * circumference;

  let color = "stroke-red-500";
  if (confidence >= 75) color = "stroke-emerald-600";
  else if (confidence >= 55) color = "stroke-amber-500";

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative flex items-center justify-center">
        <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
          <circle
            className="stroke-gray-100"
            fill="transparent"
            strokeWidth={stroke}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          <circle
            className={`${color} transition-all duration-500 ease-out`}
            fill="transparent"
            strokeWidth={stroke}
            strokeDasharray={circumference + " " + circumference}
            style={{ strokeDashoffset }}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-xl font-bold font-mono text-foreground">
          {confidence.toFixed(0)}%
        </span>
      </div>
      <span className="text-xs font-bold text-foreground-secondary mt-3">Evidence quality confidence</span>
    </div>
  );
}
