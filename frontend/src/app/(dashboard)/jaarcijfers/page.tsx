"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getJaarcijfersOverzicht, uploadBankCsv, exportJaarcijfers } from "@/lib/api";
import { JaarcijfersOverzicht, JaarcijfersData, MVAItem, BankAccountStatus } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

/* ─── Helpers ────────────────────────────────────────────────────────── */

function Row({
  label,
  value,
  bold,
  indent,
  color,
}: {
  label: string;
  value: number | null;
  bold?: boolean;
  indent?: number;
  color?: "green" | "red" | "auto";
}) {
  const pl = indent ? `pl-${indent * 4}` : "";
  const resolvedColor =
    color === "auto" ? ((value ?? 0) >= 0 ? "green" : "red") : color;
  const valCls = bold
    ? resolvedColor === "green"
      ? "font-bold text-emerald-600"
      : resolvedColor === "red"
        ? "font-bold text-red-600"
        : "font-bold text-gray-900"
    : "text-gray-700";
  const labelCls = bold ? "font-semibold text-gray-900" : `text-gray-600 ${pl}`;

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-sm ${labelCls}`}>{label}</span>
      <span className={`text-sm tabular-nums ${valCls}`}>
        {value !== null ? formatCurrency(value) : "–"}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-gray-200 my-1" />;
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <h2 className="mb-3 text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
        {title}
      </h2>
      {children}
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────────────── */

export default function JaarcijfersPage() {
  const [overzicht, setOverzicht] = useState<JaarcijfersOverzicht | null>(null);
  const [loading, setLoading] = useState(true);
  const [jaar, setJaar] = useState<number>(new Date().getFullYear() - 1);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = (await getJaarcijfersOverzicht()) as JaarcijfersOverzicht;
      setOverzicht(result);
    } catch {
      toast.error("Fout bij laden jaarcijfers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = (await uploadBankCsv(file)) as {
        account_name: string;
        transactions: number;
        min_date: string;
        max_date: string;
      };
      toast.success(
        `${res.account_name}: ${res.transactions} transacties geladen (${res.min_date} t/m ${res.max_date})`
      );
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Fout bij uploaden CSV");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading || !overzicht) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  const jaren = Object.keys(overzicht.jaren)
    .map(Number)
    .sort((a, b) => a - b);

  // Ensure selected year is valid
  const activeJaar = jaren.includes(jaar) ? jaar : jaren[jaren.length - 1];
  const d: JaarcijfersData = overzicht.jaren[activeJaar];
  const wv = d.winst_verlies;
  const bal = d.balans;
  const mva = d.mva;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header with year pill selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jaarcijfers</h1>
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500">Opwolken.com VOF</p>
            {d.bron === "accountant" ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                Accountant
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                Berekend
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5">
            {jaren.map((j) => (
              <button
                key={j}
                onClick={() => setJaar(j)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeJaar === j
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {j}
              </button>
            ))}
          </div>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleCsvUpload}
            className="hidden"
          />
          <button
            onClick={async () => {
              setExporting(true);
              try {
                await exportJaarcijfers(activeJaar);
                toast.success("Export gedownload");
              } catch (err: any) {
                toast.error(err?.message || "Fout bij exporteren");
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting}
            className="btn-primary text-sm"
          >
            {exporting ? "Exporteren…" : `Export ${activeJaar}`}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-secondary text-sm"
          >
            {uploading ? "Uploaden…" : "Bank CSV uploaden"}
          </button>
        </div>
      </div>

      {/* Bank status */}
      {overzicht.bank_status && overzicht.bank_status.length > 0 && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
          <p className="text-xs font-medium text-blue-800 mb-1">Bankdata geladen</p>
          {overzicht.bank_status.map((acc: BankAccountStatus) => (
            <p key={acc.account_number} className="text-xs text-blue-700">
              {acc.account_name} — {acc.min_date} t/m {acc.max_date}
            </p>
          ))}
        </div>
      )}

      {/* Winst & Verlies */}
      <SectionCard title="Winst & Verlies">
        <Row label="Netto-omzet" value={wv.omzet} bold />
        <Row label="Directe kosten" value={wv.kosten_direct} indent={1} />
        <Row label="Afschrijvingen" value={wv.afschrijvingen} indent={1} />
        <Divider />
        <Row label="Totaal kosten" value={wv.totaal_kosten} bold />
        <div className="border-t border-gray-300 my-1" />
        <Row label="Winst" value={wv.winst} bold color="auto" />
        <Divider />
        <div className="flex items-center justify-between py-1.5">
          <span className="text-sm text-gray-600">
            MKB-winstvrijstelling{" "}
            <span className="text-xs text-gray-400">
              ({(wv.mkb_percentage * 100).toFixed(2).replace(".", ",")}%)
            </span>
          </span>
          <span className="text-sm tabular-nums text-gray-700">
            {formatCurrency(wv.mkb_vrijstelling)}
          </span>
        </div>
        <Divider />
        <Row label="Belastbare winst" value={wv.belastbare_winst} bold />

        {/* Omzet per klant */}
        {wv.omzet_per_klant.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Omzet per klant
            </h3>
            {wv.omzet_per_klant.map((k) => (
              <div
                key={k.naam}
                className="flex items-center justify-between py-1"
              >
                <span className="text-sm text-gray-600 truncate max-w-[200px]" title={k.naam}>
                  {k.naam}
                </span>
                <span className="text-sm tabular-nums text-gray-700">
                  {formatCurrency(k.bedrag)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Kosten per categorie */}
        {wv.kosten_per_categorie.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Kosten per categorie
            </h3>
            {wv.kosten_per_categorie.map((k) => (
              <div
                key={k.naam}
                className="flex items-center justify-between py-1"
              >
                <span className="text-sm text-gray-600 truncate max-w-[200px]" title={k.naam}>
                  {k.naam}
                </span>
                <span className="text-sm tabular-nums text-gray-700">
                  {formatCurrency(k.bedrag)}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Balans */}
      <SectionCard title={`Vermogensopstelling per 31 dec ${activeJaar}`}>
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Activa
        </h3>
        <Row label="Materiële vaste activa" value={bal.activa.mva.eind ?? 0} indent={1} />
        <Row label="Debiteuren" value={bal.activa.debiteuren.eind ?? 0} indent={1} />
        <Row label="Liquide middelen" value={bal.activa.liquide_middelen.eind} indent={1} />
        <div className="border-t border-gray-300 my-1" />
        <Row label="Totaal activa" value={bal.activa.totaal.eind ?? 0} bold />

        <div className="mt-4" />
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Passiva
        </h3>
        <Row label="Eigen vermogen" value={bal.passiva.eigen_vermogen.eind ?? 0} indent={1} />
        <div className="mt-2">
          <span className="text-xs text-gray-500 font-medium pl-4">Kortlopende schulden</span>
        </div>
        <Row label="Crediteuren" value={bal.passiva.crediteuren.eind ?? 0} indent={2} />
        <Row label="Omzetbelasting" value={bal.passiva.btw_schuld.eind ?? 0} indent={2} />
        <Divider />
        <Row label="Totaal kortlopend" value={bal.passiva.kortlopend_totaal.eind ?? 0} bold />
        <div className="border-t border-gray-300 my-1" />
        <Row label="Totaal passiva" value={bal.passiva.totaal.eind ?? 0} bold />
      </SectionCard>

      {/* MVA */}
      <SectionCard title="Materiële Vaste Activa">
        <Row label="Boekwaarde begin" value={mva.totaal_boekwaarde_begin} />
        <Row
          label="Investeringen"
          value={mva.totaal_aanschaf_dit_jaar > 0 ? mva.totaal_aanschaf_dit_jaar : null}
        />
        <Row label="Afschrijvingen" value={mva.totaal_afschrijving} />
        <div className="border-t border-gray-300 my-1" />
        <Row label="Boekwaarde eind" value={mva.totaal_boekwaarde_eind} bold />

        {/* Detail table */}
        {mva.items.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100 overflow-x-auto">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Detail ({mva.items.length} activa)
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200">
                  <th className="py-1.5 text-left font-medium">Omschrijving</th>
                  <th className="py-1.5 text-left font-medium">Datum</th>
                  <th className="py-1.5 text-right font-medium">Aanschaf</th>
                  <th className="py-1.5 text-right font-medium">Jaren</th>
                  <th className="py-1.5 text-right font-medium">BW begin</th>
                  <th className="py-1.5 text-right font-medium">Afschr.</th>
                  <th className="py-1.5 text-right font-medium">BW eind</th>
                </tr>
              </thead>
              <tbody>
                {mva.items.map((item: MVAItem) => (
                  <tr key={item.id} className="border-t border-gray-50">
                    <td className="py-1 text-gray-900">
                      <div>{item.beschrijving || item.leverancier}</div>
                      <div className="text-xs text-gray-400">{item.categorie}</div>
                    </td>
                    <td className="py-1 text-gray-600 whitespace-nowrap">
                      {formatDate(item.datum)}
                    </td>
                    <td className="py-1 text-right tabular-nums text-gray-700">
                      {formatCurrency(item.aanschafwaarde)}
                    </td>
                    <td className="py-1 text-right tabular-nums text-gray-700">
                      {item.jaren}
                    </td>
                    <td className="py-1 text-right tabular-nums text-gray-700">
                      {formatCurrency(item.boekwaarde_begin)}
                    </td>
                    <td className="py-1 text-right tabular-nums text-gray-700">
                      {formatCurrency(item.afschrijving_dit_jaar)}
                    </td>
                    <td className="py-1 text-right tabular-nums text-gray-700">
                      {formatCurrency(item.boekwaarde_eind)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
