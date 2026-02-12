"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getInvoice,
  getCustomer,
  updateInvoice,
  deleteInvoice,
  generateInvoicePdf,
  sendInvoice,
} from "@/lib/api";
import { Invoice, Customer } from "@/types";
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
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ onderwerp: "", bericht: "" });

  useEffect(() => {
    getInvoice(params.id as string)
      .then(async (data) => {
        const inv = data as Invoice;
        setInvoice(inv);
        if (inv.klant_id) {
          try {
            const c = await getCustomer(inv.klant_id);
            setCustomer(c as Customer);
          } catch {
            // Customer might not exist
          }
        }
      })
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
      toast.success("PDF gedownload");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const openSendModal = () => {
    if (!invoice) return;
    setEmailForm({
      onderwerp: `Factuur ${invoice.factuurnummer}`,
      bericht: `Beste,\n\nHierbij ontvangt u factuur ${invoice.factuurnummer}.\n\nDe factuur vindt u als bijlage bij deze e-mail.\n\nMet vriendelijke groet,\nOpwolken`,
    });
    setShowSendModal(true);
  };

  const handleSend = async () => {
    setSending(true);
    setShowSendModal(false);
    try {
      await sendInvoice(params.id as string, emailForm);
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
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/facturen"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          &larr; Terug naar facturen
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
          <div className="flex flex-wrap gap-2">
            {invoice.status === "concept" && (
              <Link href={`/facturen/${params.id}/bewerken`} className="btn-secondary">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
                Bewerken
              </Link>
            )}
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
                onClick={openSendModal}
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

      {/* Main content: 50/50 split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Info */}
        <div className="space-y-4">
          {/* Customer block */}
          {customer && (
            <Link href={`/klanten/${customer.id}`} className="card block hover:ring-1 hover:ring-gray-200 transition-all">
              <h2 className="text-sm font-medium text-gray-700 mb-3">Klant</h2>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{customer.bedrijfsnaam || `${customer.voornaam} ${customer.achternaam}`}</p>
                  {customer.bedrijfsnaam && (customer.voornaam || customer.achternaam) && (
                    <p className="text-xs text-gray-500">{customer.voornaam} {customer.achternaam}</p>
                  )}
                  {customer.email && (
                    <p className="text-xs text-gray-500 mt-1">{customer.email}</p>
                  )}
                </div>
                <div className="text-right text-xs text-gray-500">
                  {customer.adres && <p>{customer.adres}</p>}
                  {(customer.postcode || customer.plaats) && (
                    <p>{[customer.postcode, customer.plaats].filter(Boolean).join(" ")}</p>
                  )}
                </div>
              </div>
              {(customer.kvk_nummer || customer.btw_nummer) && (
                <div className="mt-3 pt-3 border-t border-gray-50 flex gap-4 text-xs text-gray-500">
                  {customer.kvk_nummer && <span>KVK: {customer.kvk_nummer}</span>}
                  {customer.btw_nummer && <span>BTW: {customer.btw_nummer}</span>}
                </div>
              )}
            </Link>
          )}

          {/* Financial summary */}
          <div className="card">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Bedragen</h2>
            <div className="space-y-3">
              {invoice.regels.map((regel, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-500 truncate mr-4">
                    {regel.beschrijving}
                    <span className="text-gray-400 ml-1">
                      ({regel.aantal}× {formatCurrency(regel.tarief)})
                    </span>
                  </span>
                  <span className="font-medium text-gray-900 whitespace-nowrap">
                    {formatCurrency(regel.totaal)}
                  </span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotaal</span>
                  <span className="text-gray-900">{formatCurrency(invoice.subtotaal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">BTW</span>
                  <span className="text-gray-900">{formatCurrency(invoice.btw_totaal)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-1.5">
                  <span className="text-gray-900">Totaal</span>
                  <span className="text-gray-900">{formatCurrency(invoice.totaal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="card">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Details</h2>
            <dl className="space-y-3">
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Factuurnummer</dt>
                <dd className="font-medium text-gray-900">{invoice.factuurnummer}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Factuurdatum</dt>
                <dd className="font-medium text-gray-900">{formatDate(invoice.factuurdatum)}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Vervaldatum</dt>
                <dd className="font-medium text-gray-900">{formatDate(invoice.vervaldatum)}</dd>
              </div>
              {invoice.onderwerp && (
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500">Onderwerp</dt>
                  <dd className="font-medium text-gray-900">{invoice.onderwerp}</dd>
                </div>
              )}
              {invoice.daan_of_wim && (
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500">Eigenaar</dt>
                  <dd className="font-medium text-gray-900">{invoice.daan_of_wim}</dd>
                </div>
              )}
              {invoice.verzonden_op && (
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500">Verzonden op</dt>
                  <dd className="font-medium text-gray-900">{formatDate(invoice.verzonden_op)}</dd>
                </div>
              )}
              {invoice.betaald_op && (
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500">Betaald op</dt>
                  <dd className="font-medium text-gray-900">{formatDate(invoice.betaald_op)}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Notes */}
          {invoice.notities && (
            <div className="card">
              <h2 className="text-sm font-medium text-gray-700 mb-2">Opmerkingen</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.notities}</p>
            </div>
          )}

          {/* Danger zone */}
          <div className="border-t border-gray-100 pt-4">
            <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-700">
              Factuur verwijderen
            </button>
          </div>
        </div>

        {/* Right: PDF preview */}
        <div>
          {invoice.pdf_url ? (
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <h2 className="text-sm font-medium text-gray-700">PDF</h2>
                <a
                  href={invoice.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  Openen in nieuw tabblad
                </a>
              </div>
              <iframe
                src={invoice.pdf_url}
                className="w-full"
                style={{ height: "calc(100vh - 200px)", minHeight: "600px" }}
                title="PDF preview"
              />
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <svg className="h-12 w-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <p className="text-sm text-gray-500">Geen PDF beschikbaar</p>
              <button
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                className="mt-3 btn-secondary text-sm"
              >
                {generatingPdf ? "Genereren..." : "PDF genereren"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Send email modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 font-serif text-xl text-gray-900">Factuur versturen</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Aan</label>
                <p className="text-sm text-gray-600">{invoice.klant_naam}</p>
              </div>
              <div>
                <label className="label">Onderwerp</label>
                <input
                  type="text"
                  className="input"
                  value={emailForm.onderwerp}
                  onChange={(e) => setEmailForm({ ...emailForm, onderwerp: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Bericht</label>
                <textarea
                  className="input min-h-[180px] resize-y"
                  value={emailForm.bericht}
                  onChange={(e) => setEmailForm({ ...emailForm, bericht: e.target.value })}
                />
              </div>
              <p className="text-xs text-gray-400">De PDF wordt automatisch als bijlage toegevoegd.</p>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowSendModal(false)}
                className="btn-secondary"
              >
                Annuleren
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="btn-primary"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
                Versturen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
