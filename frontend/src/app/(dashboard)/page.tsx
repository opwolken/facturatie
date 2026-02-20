"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getDashboard, getFinancieelDashboard } from "@/lib/api";
import { DashboardData, FinancieelData } from "@/types";
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

/* ─── Skeleton helpers ───────────────────────────────────────────────── */

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-100 ${className}`} />;
}

function KpiSkeleton() {
  return (
    <div className="card">
      <Skeleton className="h-4 w-16 mb-2" />
      <Skeleton className="h-8 w-28" />
    </div>
  );
}

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card">
      <Skeleton className="h-4 w-24 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="card">
      <Skeleton className="h-4 w-24 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`card ${className}`}>
      <Skeleton className="h-4 w-40 mb-4" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [finData, setFinData] = useState<FinancieelData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingFin, setLoadingFin] = useState(true);
  const [jaar, setJaar] = useState<number | undefined>(undefined);
  const [kwartaal, setKwartaal] = useState<number>(Math.ceil((new Date().getMonth() + 1) / 3));

  // Main dashboard data (depends only on jaar)
  const loadDashboard = useCallback((j?: number) => {
    setLoadingData(true);
    getDashboard(j)
      .then((d) => setData(d as DashboardData))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoadingData(false));
  }, []);

  // Financial data (depends on jaar + kwartaal)
  const loadFinancieel = useCallback((j?: number, q?: number) => {
    setLoadingFin(true);
    getFinancieelDashboard(j, q)
      .then((f) => setFinData(f as FinancieelData))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoadingFin(false));
  }, []);

  // When jaar changes: reload both
  useEffect(() => {
    loadDashboard(jaar);
    loadFinancieel(jaar, kwartaal);
  }, [jaar]); // eslint-disable-line react-hooks/exhaustive-deps

  // When only kwartaal changes: reload only financial data
  const handleKwartaalChange = (q: number) => {
    setKwartaal(q);
    loadFinancieel(jaar, q);
  };

  const chartData = data?.maandoverzicht.map((m) => ({
    ...m,
    label: formatMonth(m.maand),
  })) ?? [];

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-4">
          <div>
            <h1 className="font-serif text-3xl text-gray-900">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">
              Overzicht van je administratie
            </p>
          </div>
          {data && data.beschikbare_jaren.length > 0 && (
            <select
              value={jaar ?? data.jaar}
              onChange={(e) => setJaar(Number(e.target.value))}
              className="mb-0.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:border-gray-300 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              {data.beschikbare_jaren.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/uitgaven/uploaden" className="btn-secondary flex-1 sm:flex-none">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Uploaden
          </Link>
          <Link href="/facturen/nieuw" className="btn-primary flex-1 sm:flex-none">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Nieuwe factuur
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {loadingData || !data ? (
          <>{[0,1,2,3].map(i => <KpiSkeleton key={i} />)}</>
        ) : (
          <>
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
          </>
        )}
      </div>

      {/* Financial blocks: Overzicht + BTW */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Overzicht */}
        {loadingFin || !finData ? (
          <CardSkeleton lines={3} />
        ) : (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-gray-700">Overzicht</h2>
              <span className="text-xs text-gray-400">{finData.winst_verlies.jaar}</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Inkomsten</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(finData.winst_verlies.inkomsten)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Uitgaven</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(finData.winst_verlies.uitgaven)}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-2">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-900">Winst</span>
                  <span className={finData.winst_verlies.winst >= 0 ? "text-emerald-600" : "text-red-600"}>
                    {formatCurrency(finData.winst_verlies.winst)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* BTW — with inline kwartaal pill selector */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-700">BTW</h2>
            <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5">
              {[1, 2, 3, 4].map((q) => (
                <button
                  key={q}
                  onClick={() => handleKwartaalChange(q)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    kwartaal === q
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Q{q}
                </button>
              ))}
            </div>
          </div>
          {loadingFin || !finData ? (
            <div className="space-y-3">
              {[0,1,2].map(i => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">1a. Omzet</span>
                <div className="flex gap-4">
                  <span className="font-medium text-gray-900">
                    {formatCurrency(finData.btw.omzet)}
                  </span>
                  <span className="font-medium text-gray-500 w-24 text-right">
                    {formatCurrency(finData.btw.omzet_btw)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">5b. Inkoop</span>
                <div className="flex gap-4">
                  <span className="font-medium text-gray-900">
                    {formatCurrency(finData.btw.inkoop)}
                  </span>
                  <span className="font-medium text-gray-500 w-24 text-right">
                    {formatCurrency(finData.btw.inkoop_btw)}
                  </span>
                </div>
              </div>
              <div className="border-t border-gray-100 pt-2">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-900">BTW af te dragen</span>
                  <span className={finData.btw.verschil >= 0 ? "text-amber-600" : "text-emerald-600"}>
                    {formatCurrency(finData.btw.verschil)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Per persoon – full width */}
      {loadingFin || !finData ? (
        <div className="mb-6"><CardSkeleton lines={4} /></div>
      ) : (
        <div className="mb-6 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-700">Per persoon</h2>
            <Link href="/winst-verlies" className="text-xs text-gray-500 hover:text-gray-700">
              Details →
            </Link>
          </div>
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-xs text-gray-400">
                  <th className="pb-2 text-left font-medium w-16"></th>
                  <th className="pb-2 text-right font-medium">Omzet</th>
                  <th className="pb-2 text-right font-medium">Kosten</th>
                  <th className="pb-2 text-right font-medium">Winst</th>
                  <th className="pb-2 text-right font-medium">IB*</th>
                  <th className="pb-2 text-right font-medium">Netto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr>
                  <td className="py-2 font-medium text-gray-700">Daan</td>
                  <td className="py-2 text-right text-gray-600">{formatCurrency(finData.inkomstenbelasting.ink_daan)}</td>
                  <td className="py-2 text-right text-gray-600">{formatCurrency(finData.inkomstenbelasting.uit_daan)}</td>
                  <td className={`py-2 text-right font-medium ${finData.inkomstenbelasting.winst_daan >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(finData.inkomstenbelasting.winst_daan)}
                  </td>
                  <td className="py-2 text-right text-amber-600">{formatCurrency(finData.inkomstenbelasting.bel_daan)}</td>
                  <td className={`py-2 text-right font-medium ${(finData.inkomstenbelasting.winst_daan - finData.inkomstenbelasting.bel_daan) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(finData.inkomstenbelasting.winst_daan - finData.inkomstenbelasting.bel_daan)}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-gray-700">Wim</td>
                  <td className="py-2 text-right text-gray-600">{formatCurrency(finData.inkomstenbelasting.ink_wim)}</td>
                  <td className="py-2 text-right text-gray-600">{formatCurrency(finData.inkomstenbelasting.uit_wim)}</td>
                  <td className={`py-2 text-right font-medium ${finData.inkomstenbelasting.winst_wim >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(finData.inkomstenbelasting.winst_wim)}
                  </td>
                  <td className="py-2 text-right text-amber-600">{formatCurrency(finData.inkomstenbelasting.bel_wim)}</td>
                  <td className={`py-2 text-right font-medium ${(finData.inkomstenbelasting.winst_wim - finData.inkomstenbelasting.bel_wim) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(finData.inkomstenbelasting.winst_wim - finData.inkomstenbelasting.bel_wim)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200">
                  <td className="pt-2 font-semibold text-gray-900">Totaal</td>
                  <td className="pt-2 text-right font-semibold text-gray-900">
                    {formatCurrency(finData.inkomstenbelasting.ink_daan + finData.inkomstenbelasting.ink_wim)}
                  </td>
                  <td className="pt-2 text-right font-semibold text-gray-900">
                    {formatCurrency(finData.inkomstenbelasting.uit_daan + finData.inkomstenbelasting.uit_wim)}
                  </td>
                  <td className={`pt-2 text-right font-semibold ${(finData.inkomstenbelasting.winst_daan + finData.inkomstenbelasting.winst_wim) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(finData.inkomstenbelasting.winst_daan + finData.inkomstenbelasting.winst_wim)}
                  </td>
                  <td className="pt-2 text-right font-semibold text-amber-600">
                    {formatCurrency(finData.inkomstenbelasting.bel_daan + finData.inkomstenbelasting.bel_wim)}
                  </td>
                  <td className={`pt-2 text-right font-semibold ${((finData.inkomstenbelasting.winst_daan - finData.inkomstenbelasting.bel_daan) + (finData.inkomstenbelasting.winst_wim - finData.inkomstenbelasting.bel_wim)) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency((finData.inkomstenbelasting.winst_daan - finData.inkomstenbelasting.bel_daan) + (finData.inkomstenbelasting.winst_wim - finData.inkomstenbelasting.bel_wim))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-3 text-[10px] text-gray-400">* Indicatief: winst × MKB-vrijstelling (86%) × (IB 49,5% + premies 5,32%)</p>
        </div>
      )}

      {/* Charts */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Revenue chart */}
        {loadingData || !data ? (
          <ChartSkeleton className="lg:col-span-2" />
        ) : (
          <div className="card lg:col-span-2">
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
        )}

        {/* Category pie chart */}
        {loadingData || !data ? (
          <CardSkeleton lines={5} />
        ) : (
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
        )}
      </div>

      {/* Recent tables */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent invoices */}
        {loadingData || !data ? (
          <TableSkeleton />
        ) : (
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
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {inv.factuurnummer}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{inv.klant_naam}</p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
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
        )}

        {/* Recent expenses */}
        {loadingData || !data ? (
          <TableSkeleton />
        ) : (
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
                  <Link
                    key={exp.id}
                    href={`/uitgaven/${exp.id}`}
                    className="flex items-center justify-between rounded-lg p-2 -mx-2 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {exp.leverancier || "Onbekend"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {exp.categorie || "Geen categorie"} · {formatDateShort(exp.datum)}
                      </p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(exp.totaal)}
                      </p>
                      <span className={`badge ${getStatusColor(exp.status)}`}>
                        {getStatusLabel(exp.status)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Nog geen uitgaven</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
