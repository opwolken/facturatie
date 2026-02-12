"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getExpenses, deleteExpense, updateExpense } from "@/lib/api";
import { Expense } from "@/types";
import {
  formatCurrency,
  formatDateShort,
  getStatusColor,
  getStatusLabel,
} from "@/lib/utils";
import { useColumnPreferences } from "@/lib/useColumnPreferences";
import DataTable, { ColumnDef, FilterOption } from "@/components/DataTable";
import toast from "react-hot-toast";

const expenseColumns: ColumnDef<Expense>[] = [
  {
    key: "leverancier",
    label: "Leverancier",
    render: (exp) => (
      <div>
        <p className="text-sm font-medium text-gray-900 hover:text-brand-600">{exp.leverancier || "Onbekend"}</p>
        {exp.factuurnummer && (
          <p className="text-xs text-gray-500">#{exp.factuurnummer}</p>
        )}
      </div>
    ),
    sortValue: (exp) => exp.leverancier || "",
    filterValue: (exp) => `${exp.leverancier || ""} ${exp.factuurnummer || ""}`,
  },
  {
    key: "factuurnummer",
    label: "Factuurnummer",
    defaultVisible: false,
    render: (exp) => <span className="text-sm text-gray-600">{exp.factuurnummer || "—"}</span>,
    sortValue: (exp) => exp.factuurnummer || "",
    filterValue: (exp) => exp.factuurnummer || "",
  },
  {
    key: "categorie",
    label: "Categorie",
    render: (exp) => <span className="text-sm text-gray-600">{exp.categorie || "—"}</span>,
    sortValue: (exp) => exp.categorie || "",
    filterValue: (exp) => exp.categorie || "",
  },
  {
    key: "beschrijving",
    label: "Beschrijving",
    defaultVisible: false,
    render: (exp) => <span className="text-sm text-gray-600">{exp.beschrijving || "—"}</span>,
    sortValue: (exp) => exp.beschrijving || "",
    filterValue: (exp) => exp.beschrijving || "",
  },
  {
    key: "datum",
    label: "Datum",
    render: (exp) => <span className="text-sm text-gray-600">{formatDateShort(exp.datum)}</span>,
    sortValue: (exp) => exp.datum,
    filterValue: (exp) => formatDateShort(exp.datum),
  },
  {
    key: "status",
    label: "Status",
    render: (exp) => (
      <span className={`badge ${getStatusColor(exp.status)}`}>{getStatusLabel(exp.status)}</span>
    ),
    sortValue: (exp) => exp.status,
    filterValue: (exp) => exp.status,
  },
  {
    key: "subtotaal",
    label: "Subtotaal",
    align: "right",
    defaultVisible: false,
    render: (exp) => <span className="text-sm text-gray-600">{formatCurrency(exp.subtotaal)}</span>,
    sortValue: (exp) => exp.subtotaal,
  },
  {
    key: "btw",
    label: "BTW",
    align: "right",
    defaultVisible: false,
    render: (exp) => <span className="text-sm text-gray-600">{formatCurrency(exp.btw)}</span>,
    sortValue: (exp) => exp.btw,
  },
  {
    key: "totaal",
    label: "Bedrag",
    align: "right",
    render: (exp) => <span className="text-sm font-medium text-gray-900">{formatCurrency(exp.totaal)}</span>,
    sortValue: (exp) => exp.totaal,
  },
];

const expenseFilters: FilterOption[] = [
  {
    key: "status",
    label: "Alle statussen",
    options: [
      { value: "nieuw", label: "Nieuw" },
      { value: "goedgekeurd", label: "Goedgekeurd" },
      { value: "betaald", label: "Betaald" },
    ],
  },
  {
    key: "categorie",
    label: "Alle categorieën",
    options: [
      { value: "Hosting & servers", label: "Hosting & servers" },
      { value: "Software & licenties", label: "Software & licenties" },
      { value: "Hardware & elektronica", label: "Hardware & elektronica" },
      { value: "Kantoor & inrichting", label: "Kantoor & inrichting" },
      { value: "Zakelijke diensten", label: "Zakelijke diensten" },
      { value: "Transport", label: "Transport" },
      { value: "Overig", label: "Overig" },
    ],
  },
];

export default function ExpensesPage() {
  const router = useRouter();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const { savedColumns, loaded, saveColumns } = useColumnPreferences("uitgaven");

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = () => {
    getExpenses()
      .then((data) => setExpenses(data as Expense[]))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Weet je zeker dat je deze uitgave wilt verwijderen?")) return;
    try {
      await deleteExpense(id);
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      toast.success("Uitgave verwijderd");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const updated = await updateExpense(id, { status: "goedgekeurd" });
      setExpenses((prev) =>
        prev.map((e) => (e.id === id ? (updated as Expense) : e))
      );
      toast.success("Uitgave goedgekeurd");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.totaal, 0);

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
          <h1 className="font-serif text-3xl text-gray-900">Uitgaven</h1>
          <p className="mt-1 text-sm text-gray-500">
            {expenses.length} uitgaven · {formatCurrency(totalExpenses)}
          </p>
        </div>
        <Link href="/uitgaven/uploaden" className="btn-primary">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <span className="hidden sm:inline">PDF uploaden</span>
          <span className="sm:hidden">Uploaden</span>
        </Link>
      </div>

      <DataTable
        data={expenses}
        columns={expenseColumns}
        filters={expenseFilters}
        storageKey="uitgaven"
        savedPreferences={savedColumns}
        onSavePreferences={saveColumns}
        onRowClick={(exp) => router.push(`/uitgaven/${exp.id}`)}
        emptyIcon={
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          </svg>
        }
        emptyTitle="Geen uitgaven"
        emptyDescription="Upload een PDF-factuur om te beginnen."
        emptyAction={
          <Link href="/uitgaven/uploaden" className="btn-primary inline-flex">
            PDF uploaden
          </Link>
        }
        actions={(expense) => (
          <div className="flex items-center justify-end gap-2">
            <Link
              href={`/uitgaven/${expense.id}`}
              className="text-gray-400 hover:text-gray-600"
              title="Bekijken"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            {expense.status === "nieuw" && (
              <button
                onClick={() => handleApprove(expense.id)}
                className="text-gray-400 hover:text-emerald-600"
                title="Goedkeuren"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </button>
            )}
            <button
              onClick={() => handleDelete(expense.id)}
              className="text-gray-400 hover:text-red-600 transition-colors"
              title="Verwijderen"
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
