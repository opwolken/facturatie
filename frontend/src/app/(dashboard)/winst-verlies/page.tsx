"use client";

import { useEffect, useState } from "react";
import { getWinstVerlies } from "@/lib/api";
import { WinstVerliesData, WinstVerliesPersoon } from "@/types";
import { formatCurrency, formatMonth } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import toast from "react-hot-toast";

function PersonCard({ naam, data, color }: { naam: string; data: WinstVerliesPersoon; color: string }) {
  const chartData = data.maandoverzicht.map((m) => ({
    ...m,
    label: formatMonth(m.maand),
    winst: Math.round(m.omzet - m.uitgaven),
  }));

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="card">
          <p className="text-xs text-gray-500">Omzet</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">
            {formatCurrency(data.omzet)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Kosten</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">
            {formatCurrency(data.uitgaven)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Winst</p>
          <p className={`mt-1 text-xl font-semibold ${data.winst >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatCurrency(data.winst)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">IB (indicatief)</p>
          <p className="mt-1 text-xl font-semibold text-amber-600">
            {formatCurrency(data.belasting)}
          </p>
        </div>
        <div className="card col-span-2 lg:col-span-1">
          <p className="text-xs text-gray-500">Netto</p>
          <p className={`mt-1 text-xl font-semibold ${data.netto >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {formatCurrency(data.netto)}
          </p>
        </div>
      </div>

      {/* Chart + breakdowns */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Monthly chart */}
        <div className="card lg:col-span-2">
          <h3 className="mb-4 text-sm font-medium text-gray-700">Per maand</h3>
          <div className="h-56">
            {chartData.some((m) => m.omzet > 0 || m.uitgaven > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5", fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="omzet" fill={color} radius={[3, 3, 0, 0]} name="Omzet" />
                  <Bar dataKey="uitgaven" fill="#e5e7eb" radius={[3, 3, 0, 0]} name="Kosten" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-400">
                Geen data beschikbaar
              </div>
            )}
          </div>
        </div>

        {/* Breakdown lists */}
        <div className="space-y-4">
          {/* Income by client */}
          <div className="card">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Omzet per klant</h3>
            {data.omzet_per_klant.length > 0 ? (
              <div className="space-y-2">
                {data.omzet_per_klant.map((item) => (
                  <div key={item.naam} className="flex items-center justify-between text-sm">
                    <span className="truncate text-gray-600 mr-2">{item.naam}</span>
                    <span className="flex-shrink-0 font-medium text-gray-900">
                      {formatCurrency(item.bedrag)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-2">
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-gray-900">Totaal</span>
                    <span className="text-gray-900">{formatCurrency(data.omzet)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Geen inkomsten</p>
            )}
          </div>

          {/* Expenses by category */}
          <div className="card">
            <h3 className="mb-3 text-sm font-medium text-gray-700">Kosten per categorie</h3>
            {data.uitgaven_per_categorie.length > 0 ? (
              <div className="space-y-2">
                {data.uitgaven_per_categorie.map((item) => (
                  <div key={item.naam} className="flex items-center justify-between text-sm">
                    <span className="truncate text-gray-600 mr-2">{item.naam}</span>
                    <span className="flex-shrink-0 font-medium text-gray-900">
                      {formatCurrency(item.bedrag)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-gray-100 pt-2">
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-gray-900">Totaal</span>
                    <span className="text-gray-900">{formatCurrency(data.uitgaven)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Geen kosten</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WinstVerliesPage() {
  const [data, setData] = useState<WinstVerliesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [jaar, setJaar] = useState<number | undefined>(undefined);
  const [activePerson, setActivePerson] = useState<"daan" | "wim">("daan");

  useEffect(() => {
    setLoading(true);
    getWinstVerlies(jaar)
      .then((d) => {
        const wvData = d as WinstVerliesData;
        setData(wvData);
        if (!jaar) setJaar(wvData.jaar);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [jaar]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    );
  }

  if (!data) return null;

  const personData = activePerson === "daan" ? data.daan : data.wim;
  const totalOmzet = data.daan.omzet + data.wim.omzet;
  const totalUitgaven = data.daan.uitgaven + data.wim.uitgaven;
  const totalWinst = data.daan.winst + data.wim.winst;
  const totalBelasting = data.daan.belasting + data.wim.belasting;
  const totalNetto = data.daan.netto + data.wim.netto;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-end gap-4">
          <div>
            <h1 className="font-serif text-3xl text-gray-900">Winst & Verlies</h1>
            <p className="mt-1 text-sm text-gray-500">
              Overzicht per persoon
            </p>
          </div>
          {data.beschikbare_jaren.length > 0 && (
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
      </div>

      {/* Total summary */}
      <div className="mb-6 card">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Totaaloverzicht {data.jaar}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400">
                <th className="pb-2 font-medium"></th>
                <th className="pb-2 pr-4 text-right font-medium">Omzet</th>
                <th className="pb-2 pr-4 text-right font-medium">Kosten</th>
                <th className="pb-2 pr-4 text-right font-medium">Winst</th>
                <th className="pb-2 pr-4 text-right font-medium">IB (ind.)</th>
                <th className="pb-2 text-right font-medium">Netto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <tr>
                <td className="py-2 font-medium text-gray-700">Daan</td>
                <td className="py-2 pr-4 text-right text-gray-600">{formatCurrency(data.daan.omzet)}</td>
                <td className="py-2 pr-4 text-right text-gray-600">{formatCurrency(data.daan.uitgaven)}</td>
                <td className={`py-2 pr-4 text-right font-medium ${data.daan.winst >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(data.daan.winst)}
                </td>
                <td className="py-2 pr-4 text-right text-amber-600">{formatCurrency(data.daan.belasting)}</td>
                <td className={`py-2 text-right font-medium ${data.daan.netto >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(data.daan.netto)}
                </td>
              </tr>
              <tr>
                <td className="py-2 font-medium text-gray-700">Wim</td>
                <td className="py-2 pr-4 text-right text-gray-600">{formatCurrency(data.wim.omzet)}</td>
                <td className="py-2 pr-4 text-right text-gray-600">{formatCurrency(data.wim.uitgaven)}</td>
                <td className={`py-2 pr-4 text-right font-medium ${data.wim.winst >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(data.wim.winst)}
                </td>
                <td className="py-2 pr-4 text-right text-amber-600">{formatCurrency(data.wim.belasting)}</td>
                <td className={`py-2 text-right font-medium ${data.wim.netto >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(data.wim.netto)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200">
                <td className="pt-2 font-semibold text-gray-900">Totaal</td>
                <td className="pt-2 pr-4 text-right font-semibold text-gray-900">{formatCurrency(totalOmzet)}</td>
                <td className="pt-2 pr-4 text-right font-semibold text-gray-900">{formatCurrency(totalUitgaven)}</td>
                <td className={`pt-2 pr-4 text-right font-semibold ${totalWinst >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(totalWinst)}
                </td>
                <td className="pt-2 pr-4 text-right font-semibold text-amber-600">{formatCurrency(totalBelasting)}</td>
                <td className={`pt-2 text-right font-semibold ${totalNetto >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(totalNetto)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Person tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        <button
          onClick={() => setActivePerson("daan")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            activePerson === "daan"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Daan
        </button>
        <button
          onClick={() => setActivePerson("wim")}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            activePerson === "wim"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Wim
        </button>
      </div>

      {/* Person detail */}
      <PersonCard
        naam={activePerson === "daan" ? "Daan" : "Wim"}
        data={personData}
        color={activePerson === "daan" ? "#4c6ef5" : "#7950f2"}
      />
    </div>
  );
}
