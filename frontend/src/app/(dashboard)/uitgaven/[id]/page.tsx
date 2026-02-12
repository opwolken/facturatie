"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getExpense, updateExpense, deleteExpense } from "@/lib/api";
import { Expense } from "@/types";
import {
  formatCurrency,
  formatDate,
  getStatusColor,
  getStatusLabel,
} from "@/lib/utils";
import toast from "react-hot-toast";

export default function ExpenseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExpense(params.id as string)
      .then((data) => setExpense(data as Expense))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleStatusChange = async (status: string) => {
    try {
      const updated = await updateExpense(params.id as string, { status });
      setExpense(updated as Expense);
      toast.success(`Status gewijzigd naar ${getStatusLabel(status)}`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Weet je zeker dat je deze uitgave wilt verwijderen?")) return;
    try {
      await deleteExpense(params.id as string);
      toast.success("Uitgave verwijderd");
      router.push("/uitgaven");
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

  if (!expense) return null;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/uitgaven"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          &larr; Terug naar uitgaven
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-3xl text-gray-900">
                {expense.leverancier || "Uitgave"}
              </h1>
              <span className={`badge ${getStatusColor(expense.status)}`}>
                {getStatusLabel(expense.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {expense.factuurnummer && `#${expense.factuurnummer} · `}
              {formatDate(expense.datum)}
              {expense.categorie && ` · ${expense.categorie}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {expense.status === "nieuw" && (
              <button
                onClick={() => handleStatusChange("goedgekeurd")}
                className="btn-primary"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Goedkeuren
              </button>
            )}
            {expense.status === "goedgekeurd" && (
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
          {/* Financial summary */}
          <div className="card">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Bedragen</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotaal</span>
                <span className="font-medium text-gray-900">{formatCurrency(expense.subtotaal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">BTW</span>
                <span className="font-medium text-gray-900">{formatCurrency(expense.btw)}</span>
              </div>
              <div className="border-t border-gray-100 pt-2">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-gray-900">Totaal</span>
                  <span className="text-gray-900">{formatCurrency(expense.totaal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="card">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Details</h2>
            <dl className="space-y-3">
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Leverancier</dt>
                <dd className="font-medium text-gray-900">{expense.leverancier || "—"}</dd>
              </div>
              {expense.factuurnummer && (
                <div className="flex justify-between text-sm">
                  <dt className="text-gray-500">Factuurnummer</dt>
                  <dd className="font-medium text-gray-900">{expense.factuurnummer}</dd>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Datum</dt>
                <dd className="font-medium text-gray-900">{formatDate(expense.datum)}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Categorie</dt>
                <dd className="font-medium text-gray-900">{expense.categorie || "—"}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Eigenaar</dt>
                <dd className="font-medium text-gray-900">{expense.daan_of_wim || "Beiden"}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Status</dt>
                <dd>
                  <span className={`badge ${getStatusColor(expense.status)}`}>
                    {getStatusLabel(expense.status)}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Description */}
          {expense.beschrijving && (
            <div className="card">
              <h2 className="text-sm font-medium text-gray-700 mb-2">Beschrijving</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{expense.beschrijving}</p>
            </div>
          )}

          {/* Danger zone */}
          <div className="border-t border-gray-100 pt-4">
            <button onClick={handleDelete} className="text-sm text-red-500 hover:text-red-700">
              Uitgave verwijderen
            </button>
          </div>
        </div>

        {/* Right: PDF preview */}
        <div>
          {expense.pdf_url ? (
            <div className="card p-0 overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <h2 className="text-sm font-medium text-gray-700">PDF</h2>
                <a
                  href={expense.pdf_url}
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
                src={expense.pdf_url}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
