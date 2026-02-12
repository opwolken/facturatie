"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getDashboard } from "@/lib/api";
import { DashboardData } from "@/types";
import { formatCurrency, formatMonth, getStatusColor, getStatusLabel, formatDateShort } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import toast from "react-hot-toast";

const PIE_COLORS = ["#4c6ef5", "#37b24d", "#f59f00", "#e64980", "#7950f2", "#20c997"];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard()
      .then((d) => setData(d as DashboardData))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    );
  }

  if (!data) return null;

  const chartData = data.maandoverzicht.map((m) => ({
    ...m,
    label: formatMonth(m.maand),
  }));

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overzicht van je administratie
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/uitgaven/uploaden" className="btn-secondary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Uitgave uploaden
          </Link>
          <Link href="/facturen/nieuw" className="btn-primary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nieuwe factuur
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Omzet</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatCurrency(data.totaal_omzet)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Openstaand</p>
          <p className="mt-1 text-2xl font-semibold text-amber-600">
            {formatCurrency(data.totaal_openstaand)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Uitgaven</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {formatCurrency(data.totaal_uitgaven)}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Winst</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-600">
            {formatCurrency(data.winst)}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        {/* Revenue chart */}
        <div className="card col-span-2">
          <h2 className="mb-4 text-sm font-medium text-gray-700">
            Omzet & Uitgaven per maand
          </h2>
          <div className="h-64">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5", fontSize: "13px" }}
                  />
                  <Bar dataKey="omzet" fill="#4c6ef5" radius={[4, 4, 0, 0]} name="Omzet" />
                  <Bar dataKey="uitgaven" fill="#e5e7eb" radius={[4, 4, 0, 0]} name="Uitgaven" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                Nog geen data beschikbaar
              </div>
            )}
          </div>
        </div>

        {/* Category pie chart */}
        <div className="card">
          <h2 className="mb-4 text-sm font-medium text-gray-700">
            Uitgaven per categorie
          </h2>
          <div className="h-48">
            {data.categorieën.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.categorieën}
                    dataKey="totaal"
                    nameKey="categorie"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {data.categorieën.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5", fontSize: "13px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                Geen uitgaven
              </div>
            )}
          </div>
          {data.categorieën.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {data.categorieën.slice(0, 4).map((cat, i) => (
                <div key={cat.categorie} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-gray-600">{cat.categorie}</span>
                  </div>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(cat.totaal)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent tables */}
      <div className="grid grid-cols-2 gap-4">
        {/* Recent invoices */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">
              Recente facturen
            </h2>
            <Link href="/facturen" className="text-xs text-gray-500 hover:text-gray-700">
              Alles bekijken
            </Link>
          </div>
          {data.recente_facturen.length > 0 ? (
            <div className="space-y-3">
              {data.recente_facturen.map((inv) => (
                <Link
                  key={inv.id}
                  href={`/facturen/${inv.id}`}
                  className="flex items-center justify-between rounded-lg p-2 -mx-2 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {inv.factuurnummer}
                    </p>
                    <p className="text-xs text-gray-500">{inv.klant_naam}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(inv.totaal)}
                    </p>
                    <span className={`badge ${getStatusColor(inv.status)}`}>
                      {getStatusLabel(inv.status)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nog geen facturen</p>
          )}
        </div>

        {/* Recent expenses */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-700">
              Recente uitgaven
            </h2>
            <Link href="/uitgaven" className="text-xs text-gray-500 hover:text-gray-700">
              Alles bekijken
            </Link>
          </div>
          {data.recente_uitgaven.length > 0 ? (
            <div className="space-y-3">
              {data.recente_uitgaven.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between rounded-lg p-2 -mx-2"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {exp.leverancier || "Onbekend"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {exp.categorie || "Geen categorie"} · {formatDateShort(exp.datum)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(exp.totaal)}
                    </p>
                    <span className={`badge ${getStatusColor(exp.status)}`}>
                      {getStatusLabel(exp.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nog geen uitgaven</p>
          )}
        </div>
      </div>
    </div>
  );
}
