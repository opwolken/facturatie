"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createInvoice, getCustomers } from "@/lib/api";
import { Customer, InvoiceLineItem } from "@/types";
import { formatCurrency, todayISO, addDays } from "@/lib/utils";
import toast from "react-hot-toast";

const emptyLine: InvoiceLineItem = {
  beschrijving: "",
  aantal: 1,
  tarief: 0,
  btw_percentage: 21,
  totaal: 0,
};

export default function NewInvoicePage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    klant_id: "",
    klant_naam: "",
    factuurdatum: todayISO(),
    vervaldatum: addDays(todayISO(), 30),
    onderwerp: "",
    notities: "",
    regels: [{ ...emptyLine }] as InvoiceLineItem[],
  });

  useEffect(() => {
    getCustomers()
      .then((data) => setCustomers(data as Customer[]))
      .catch(() => {});
  }, []);

  const updateLine = (index: number, field: string, value: any) => {
    const newRegels = [...form.regels];
    (newRegels[index] as any)[field] = value;
    newRegels[index].totaal = newRegels[index].aantal * newRegels[index].tarief;
    setForm({ ...form, regels: newRegels });
  };

  const addLine = () => {
    setForm({ ...form, regels: [...form.regels, { ...emptyLine }] });
  };

  const removeLine = (index: number) => {
    if (form.regels.length <= 1) return;
    setForm({ ...form, regels: form.regels.filter((_, i) => i !== index) });
  };

  const subtotaal = form.regels.reduce((sum, r) => sum + r.aantal * r.tarief, 0);
  const btwTotaal = form.regels.reduce(
    (sum, r) => sum + r.aantal * r.tarief * (r.btw_percentage / 100),
    0
  );
  const totaal = subtotaal + btwTotaal;

  const handleCustomerChange = (id: string) => {
    const customer = customers.find((c) => c.id === id);
    setForm({
      ...form,
      klant_id: id,
      klant_naam: customer ? customer.bedrijfsnaam : "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.klant_id) {
      toast.error("Selecteer een klant");
      return;
    }
    if (form.regels.every((r) => !r.beschrijving)) {
      toast.error("Voeg minimaal één regel toe");
      return;
    }

    setSaving(true);
    try {
      const result = await createInvoice(form);
      toast.success("Factuur aangemaakt");
      router.push(`/facturen/${(result as any).id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <Link href="/facturen" className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block">
          &larr; Terug naar facturen
        </Link>
        <h1 className="font-serif text-3xl text-gray-900">Nieuwe factuur</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-6 mb-8">
          {/* Customer */}
          <div className="card">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Klantgegevens</h2>
            <div>
              <label className="label">Klant</label>
              <select
                className="input"
                value={form.klant_id}
                onChange={(e) => handleCustomerChange(e.target.value)}
              >
                <option value="">Selecteer een klant...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.bedrijfsnaam}
                  </option>
                ))}
              </select>
            </div>
            {!customers.length && (
              <p className="mt-3 text-xs text-gray-400">
                <Link href="/klanten/nieuw" className="text-brand-600 hover:text-brand-700">
                  Maak eerst een klant aan
                </Link>
              </p>
            )}
          </div>

          {/* Invoice details */}
          <div className="card">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Factuurgegevens</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Factuurdatum</label>
                <input
                  type="date"
                  className="input"
                  value={form.factuurdatum}
                  onChange={(e) => setForm({ ...form, factuurdatum: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Vervaldatum</label>
                <input
                  type="date"
                  className="input"
                  value={form.vervaldatum}
                  onChange={(e) => setForm({ ...form, vervaldatum: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="label">Onderwerp</label>
              <input
                type="text"
                className="input"
                placeholder="bijv. Webdesign werkzaamheden"
                value={form.onderwerp}
                onChange={(e) => setForm({ ...form, onderwerp: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Line items */}
        <div className="card mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Regels</h2>
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-12 gap-3 text-xs font-medium uppercase tracking-wider text-gray-500">
              <div className="col-span-5">Omschrijving</div>
              <div className="col-span-2">Aantal</div>
              <div className="col-span-2">Tarief</div>
              <div className="col-span-1">BTW %</div>
              <div className="col-span-1 text-right">Totaal</div>
              <div className="col-span-1" />
            </div>

            {form.regels.map((regel, i) => (
              <div key={i} className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-5">
                  <input
                    type="text"
                    className="input"
                    placeholder="Omschrijving"
                    value={regel.beschrijving}
                    onChange={(e) => updateLine(i, "beschrijving", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    className="input"
                    min="0"
                    step="0.5"
                    value={regel.aantal}
                    onChange={(e) => updateLine(i, "aantal", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    className="input"
                    min="0"
                    step="0.01"
                    value={regel.tarief}
                    onChange={(e) => updateLine(i, "tarief", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="col-span-1">
                  <select
                    className="input"
                    value={regel.btw_percentage}
                    onChange={(e) => updateLine(i, "btw_percentage", parseFloat(e.target.value))}
                  >
                    <option value={0}>0%</option>
                    <option value={9}>9%</option>
                    <option value={21}>21%</option>
                  </select>
                </div>
                <div className="col-span-1 text-right text-sm font-medium text-gray-900">
                  {formatCurrency(regel.aantal * regel.tarief)}
                </div>
                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addLine}
            className="mt-4 btn-ghost text-xs"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Regel toevoegen
          </button>

          {/* Totals */}
          <div className="mt-6 border-t border-gray-100 pt-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotaal</span>
                  <span className="text-gray-900">{formatCurrency(subtotaal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">BTW</span>
                  <span className="text-gray-900">{formatCurrency(btwTotaal)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold border-t border-gray-200 pt-2">
                  <span className="text-gray-900">Totaal</span>
                  <span className="text-gray-900">{formatCurrency(totaal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="card mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Opmerkingen</h2>
          <textarea
            className="input min-h-[80px]"
            placeholder="Opmerkingen op de factuur (optioneel)"
            value={form.notities}
            onChange={(e) => setForm({ ...form, notities: e.target.value })}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/facturen" className="btn-secondary">
            Annuleren
          </Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Opslaan..." : "Factuur aanmaken"}
          </button>
        </div>
      </form>
    </div>
  );
}
