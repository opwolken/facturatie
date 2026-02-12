"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getInvoices, deleteInvoice } from "@/lib/api";
import { Invoice } from "@/types";
import { formatCurrency, formatDateShort, getStatusColor, getStatusLabel } from "@/lib/utils";
import { useColumnPreferences } from "@/lib/useColumnPreferences";
import DataTable, { ColumnDef, FilterOption } from "@/components/DataTable";
import toast from "react-hot-toast";

const invoiceColumns: ColumnDef<Invoice>[] = [
  {
    key: "factuurnummer",
    label: "Nummer",
    render: (inv) => (
      <Link href={`/facturen/${inv.id}`} className="text-sm font-medium text-gray-900 hover:text-brand-600">
        {inv.factuurnummer}
      </Link>
    ),
    sortValue: (inv) => inv.factuurnummer,
    filterValue: (inv) => inv.factuurnummer,
  },
  {
    key: "klant_naam",
    label: "Klant",
    render: (inv) => <span className="text-sm text-gray-600">{inv.klant_naam || "—"}</span>,
    sortValue: (inv) => inv.klant_naam || "",
    filterValue: (inv) => inv.klant_naam || "",
  },
  {
    key: "onderwerp",
    label: "Onderwerp",
    defaultVisible: false,
    render: (inv) => <span className="text-sm text-gray-600">{inv.onderwerp || "—"}</span>,
    sortValue: (inv) => inv.onderwerp || "",
    filterValue: (inv) => inv.onderwerp || "",
  },
  {
    key: "factuurdatum",
    label: "Datum",
    render: (inv) => <span className="text-sm text-gray-600">{formatDateShort(inv.factuurdatum)}</span>,
    sortValue: (inv) => inv.factuurdatum,
    filterValue: (inv) => formatDateShort(inv.factuurdatum),
  },
  {
    key: "vervaldatum",
    label: "Vervaldatum",
    defaultVisible: false,
    render: (inv) => <span className="text-sm text-gray-600">{formatDateShort(inv.vervaldatum)}</span>,
    sortValue: (inv) => inv.vervaldatum,
    filterValue: (inv) => formatDateShort(inv.vervaldatum),
  },
  {
    key: "status",
    label: "Status",
    render: (inv) => (
      <span className={`badge ${getStatusColor(inv.status)}`}>{getStatusLabel(inv.status)}</span>
    ),
    sortValue: (inv) => inv.status,
    filterValue: (inv) => inv.status,
  },
  {
    key: "subtotaal",
    label: "Subtotaal",
    align: "right",
    defaultVisible: false,
    render: (inv) => <span className="text-sm text-gray-600">{formatCurrency(inv.subtotaal)}</span>,
    sortValue: (inv) => inv.subtotaal,
  },
  {
    key: "btw_totaal",
    label: "BTW",
    align: "right",
    defaultVisible: false,
    render: (inv) => <span className="text-sm text-gray-600">{formatCurrency(inv.btw_totaal)}</span>,
    sortValue: (inv) => inv.btw_totaal,
  },
  {
    key: "totaal",
    label: "Bedrag",
    align: "right",
    render: (inv) => <span className="text-sm font-medium text-gray-900">{formatCurrency(inv.totaal)}</span>,
    sortValue: (inv) => inv.totaal,
  },
];

const invoiceFilters: FilterOption[] = [
  {
    key: "status",
    label: "Alle statussen",
    options: [
      { value: "concept", label: "Concept" },
      { value: "verzonden", label: "Verzonden" },
      { value: "betaald", label: "Betaald" },
      { value: "verlopen", label: "Verlopen" },
    ],
  },
];

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const { savedColumns, loaded, saveColumns } = useColumnPreferences("facturen");

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = () => {
    getInvoices()
      .then((data) => setInvoices(data as Invoice[]))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Weet je zeker dat je deze factuur wilt verwijderen?")) return;
    try {
      await deleteInvoice(id);
      setInvoices((prev) => prev.filter((i) => i.id !== id));
      toast.success("Factuur verwijderd");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading || !loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-gray-900">Facturen</h1>
          <p className="mt-1 text-sm text-gray-500">
            {invoices.length} facturen
          </p>
        </div>
        <Link href="/facturen/nieuw" className="btn-primary">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="hidden sm:inline">Nieuwe factuur</span>
          <span className="sm:hidden">Nieuw</span>
        </Link>
      </div>

      <DataTable
        data={invoices}
        columns={invoiceColumns}
        filters={invoiceFilters}
        storageKey="facturen"
        savedPreferences={savedColumns}
        onSavePreferences={saveColumns}
        onRowClick={(inv) => router.push(`/facturen/${inv.id}`)}
        emptyIcon={
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
        }
        emptyTitle="Geen facturen"
        emptyDescription="Maak je eerste factuur aan."
        emptyAction={
          <Link href="/facturen/nieuw" className="btn-primary inline-flex">
            Nieuwe factuur
          </Link>
        }
        actions={(invoice) => (
          <div className="flex items-center justify-end gap-2">
            <Link
              href={`/facturen/${invoice.id}`}
              className="text-gray-400 hover:text-gray-600"
              title="Bekijken"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            <button
              onClick={() => handleDelete(invoice.id)}
              className="text-gray-400 hover:text-red-600 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        )}
      />
    </div>
  );
}
