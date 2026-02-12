"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getInvoice,
  updateInvoice,
  deleteInvoice,
  generateInvoicePdf,
  sendInvoice,
} from "@/lib/api";
import { Invoice } from "@/types";
import {
  formatCurrency,
  formatDate,
  getStatusColor,
  getStatusLabel,
} from "@/lib/utils";
import toast from "react-hot-toast";

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    getInvoice(params.id as string)
      .then((data) => setInvoice(data as Invoice))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleStatusChange = async (status: string) => {
    try {
      const updated = await updateInvoice(params.id as string, { status });
      setInvoice(updated as Invoice);
      toast.success(`Status gewijzigd naar ${getStatusLabel(status)}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleGeneratePdf = async () => {
    setGeneratingPdf(true);
    try {
      await generateInvoicePdf(params.id as string);
      toast.success("PDF gegenereerd");
      // Reload to get updated pdf_url
      const updated = await getInvoice(params.id as string);
      setInvoice(updated as Invoice);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSend = async () => {
    if (!confirm("Wil je deze factuur versturen naar de klant?")) return;
    setSending(true);
    try {
      await sendInvoice(params.id as string);
      toast.success("Factuur verzonden!");
      const updated = await getInvoice(params.id as string);
      setInvoice(updated as Invoice);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Weet je zeker dat je deze factuur wilt verwijderen?")) return;
    try {
      await deleteInvoice(params.id as string);
      toast.success("Factuur verwijderd");
      router.push("/facturen");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    );
  }

  if (!invoice) return null;

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/facturen"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          &larr; Terug naar facturen
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-3xl text-gray-900">
                {invoice.factuurnummer}
              </h1>
              <span className={`badge ${getStatusColor(invoice.status)}`}>
                {getStatusLabel(invoice.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {invoice.klant_naam} · {formatDate(invoice.factuurdatum)}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGeneratePdf}
              disabled={generatingPdf}
              className="btn-secondary"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              {generatingPdf ? "Genereren..." : "PDF"}
            </button>
            {invoice.status === "concept" && (
              <button
                onClick={handleSend}
                disabled={sending}
                className="btn-primary"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                {sending ? "Verzenden..." : "Versturen"}
              </button>
            )}
            {invoice.status === "verzonden" && (
              <button
                onClick={() => handleStatusChange("betaald")}
                className="btn-primary"
              >
                Markeer als betaald
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Invoice content */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Klant</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {invoice.klant_naam}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Vervaldatum</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {formatDate(invoice.vervaldatum)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Totaal</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {formatCurrency(invoice.totaal)}
          </p>
        </div>
      </div>

      {invoice.onderwerp && (
        <div className="card mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Onderwerp</p>
          <p className="text-sm text-gray-900">{invoice.onderwerp}</p>
        </div>
      )}

      {/* Line items */}
      <div className="card mb-8 p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Omschrijving
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Aantal
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Tarief
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                BTW
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Totaal
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {invoice.regels.map((regel, i) => (
              <tr key={i}>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {regel.beschrijving}
                </td>
                <td className="px-6 py-4 text-right text-sm text-gray-600">
                  {regel.aantal}
                </td>
                <td className="px-6 py-4 text-right text-sm text-gray-600">
                  {formatCurrency(regel.tarief)}
                </td>
                <td className="px-6 py-4 text-right text-sm text-gray-600">
                  {regel.btw_percentage}%
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                  {formatCurrency(regel.totaal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-gray-100 px-6 py-4">
          <div className="flex justify-end">
            <div className="w-64 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotaal</span>
                <span>{formatCurrency(invoice.subtotaal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">BTW</span>
                <span>{formatCurrency(invoice.btw_totaal)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-1.5">
                <span>Totaal</span>
                <span>{formatCurrency(invoice.totaal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {invoice.notities && (
        <div className="card mb-8">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
            Opmerkingen
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {invoice.notities}
          </p>
        </div>
      )}

      {/* Danger zone */}
      <div className="border-t border-gray-100 pt-6">
        <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-700">
          Factuur verwijderen
        </button>
      </div>
    </div>
  );
}
