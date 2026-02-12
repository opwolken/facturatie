"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCustomers, deleteCustomer } from "@/lib/api";
import { Customer } from "@/types";
import { useColumnPreferences } from "@/lib/useColumnPreferences";
import DataTable, { ColumnDef } from "@/components/DataTable";
import toast from "react-hot-toast";

const customerColumns: ColumnDef<Customer>[] = [
  {
    key: "bedrijfsnaam",
    label: "Bedrijfsnaam",
    render: (c) => (
      <Link href={`/klanten/${c.id}`} className="text-sm font-medium text-gray-900 hover:text-brand-600">
        {c.bedrijfsnaam}
      </Link>
    ),
    sortValue: (c) => c.bedrijfsnaam,
    filterValue: (c) => c.bedrijfsnaam,
  },
  {
    key: "contactpersoon",
    label: "Contactpersoon",
    render: (c) => (
      <span className="text-sm text-gray-600">
        {[c.voornaam, c.achternaam].filter(Boolean).join(" ") || "—"}
      </span>
    ),
    sortValue: (c) => `${c.voornaam || ""} ${c.achternaam || ""}`.trim(),
    filterValue: (c) => `${c.voornaam || ""} ${c.achternaam || ""}`.trim(),
  },
  {
    key: "email",
    label: "E-mail",
    render: (c) => <span className="text-sm text-gray-600">{c.email || "—"}</span>,
    sortValue: (c) => c.email || "",
    filterValue: (c) => c.email || "",
  },
  {
    key: "telefoon",
    label: "Telefoon",
    defaultVisible: false,
    render: (c) => <span className="text-sm text-gray-600">{c.telefoon || "—"}</span>,
    sortValue: (c) => c.telefoon || "",
    filterValue: (c) => c.telefoon || "",
  },
  {
    key: "adres",
    label: "Adres",
    defaultVisible: false,
    render: (c) => (
      <span className="text-sm text-gray-600">
        {c.adres ? `${c.adres}, ${c.postcode} ${c.plaats}` : "—"}
      </span>
    ),
    sortValue: (c) => c.adres || "",
    filterValue: (c) => `${c.adres || ""} ${c.postcode || ""} ${c.plaats || ""}`,
  },
  {
    key: "plaats",
    label: "Plaats",
    render: (c) => <span className="text-sm text-gray-600">{c.plaats || "—"}</span>,
    sortValue: (c) => c.plaats || "",
    filterValue: (c) => c.plaats || "",
  },
  {
    key: "kvk_nummer",
    label: "KvK",
    defaultVisible: false,
    render: (c) => <span className="text-sm text-gray-600">{c.kvk_nummer || "—"}</span>,
    sortValue: (c) => c.kvk_nummer || "",
    filterValue: (c) => c.kvk_nummer || "",
  },
  {
    key: "btw_nummer",
    label: "BTW-nummer",
    defaultVisible: false,
    render: (c) => <span className="text-sm text-gray-600">{c.btw_nummer || "—"}</span>,
    sortValue: (c) => c.btw_nummer || "",
    filterValue: (c) => c.btw_nummer || "",
  },
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const { savedColumns, loaded, saveColumns } = useColumnPreferences("klanten");

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = () => {
    getCustomers()
      .then((data) => setCustomers(data as Customer[]))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Weet je zeker dat je deze klant wilt verwijderen?")) return;
    try {
      await deleteCustomer(id);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      toast.success("Klant verwijderd");
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
          <h1 className="font-serif text-3xl text-gray-900">Klanten</h1>
          <p className="mt-1 text-sm text-gray-500">
            {customers.length} klanten
          </p>
        </div>
        <Link href="/klanten/nieuw" className="btn-primary">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nieuwe klant
        </Link>
      </div>

      <DataTable
        data={customers}
        columns={customerColumns}
        storageKey="klanten"
        savedPreferences={savedColumns}
        onSavePreferences={saveColumns}
        emptyIcon={
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        }
        emptyTitle="Geen klanten"
        emptyDescription="Voeg je eerste klant toe."
        emptyAction={
          <Link href="/klanten/nieuw" className="btn-primary inline-flex">
            Nieuwe klant
          </Link>
        }
        actions={(customer) => (
          <div className="flex items-center justify-end gap-1">
            <Link
              href={`/klanten/${customer.id}`}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </Link>
            <button
              onClick={() => handleDelete(customer.id)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600"
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
