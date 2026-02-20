"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getExpense, updateExpense } from "@/lib/api";
import { Expense } from "@/types";
import toast from "react-hot-toast";

export default function EditExpensePage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    leverancier: "",
    factuurnummer: "",
    datum: "",
    categorie: "",
    beschrijving: "",
    subtotaal: 0,
    btw: 0,
    totaal: 0,
    status: "nieuw",
    daan_of_wim: "Beiden",
  });

  useEffect(() => {
    getExpense(params.id as string)
      .then((data) => {
        const exp = data as Expense;
        setForm({
          leverancier: exp.leverancier || "",
          factuurnummer: exp.factuurnummer || "",
          datum: exp.datum || "",
          categorie: exp.categorie || "",
          beschrijving: exp.beschrijving || "",
          subtotaal: exp.subtotaal || 0,
          btw: exp.btw || 0,
          totaal: exp.totaal || 0,
          status: exp.status || "nieuw",
          daan_of_wim: exp.daan_of_wim || "Beiden",
        });
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  const recalcTotaal = (subtotaal: number, btw: number) => {
    return subtotaal + btw;
  };

  const handleSubtotaalChange = (value: number) => {
    setForm((f) => ({ ...f, subtotaal: value, totaal: recalcTotaal(value, f.btw) }));
  };

  const handleBtwChange = (value: number) => {
    setForm((f) => ({ ...f, btw: value, totaal: recalcTotaal(f.subtotaal, value) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateExpense(params.id as string, form);
      toast.success("Uitgave opgeslagen");
      router.push(`/uitgaven/${params.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/uitgaven/${params.id}`}
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          &larr; Terug naar uitgave
        </Link>
        <h1 className="font-serif text-3xl text-gray-900">Uitgave bewerken</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 mb-6 sm:grid-cols-2">
          {/* Leverancier & factuurnummer */}
          <div className="card">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Leverancier</h2>
            <div>
              <label className="label">Leverancier</label>
              <input
                type="text"
                className="input"
                value={form.leverancier}
                onChange={(e) => setForm({ ...form, leverancier: e.target.value })}
              />
            </div>
            <div className="mt-4">
              <label className="label">Factuurnummer</label>
              <input
                type="text"
                className="input"
                value={form.factuurnummer}
                onChange={(e) => setForm({ ...form, factuurnummer: e.target.value })}
              />
            </div>
          </div>

          {/* Details */}
          <div className="card">
            <h2 className="text-sm font-medium text-gray-700 mb-4">Details</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Datum</label>
                <input
                  type="date"
                  className="input"
                  value={form.datum}
                  onChange={(e) => setForm({ ...form, datum: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="nieuw">Nieuw</option>
                  <option value="goedgekeurd">Goedgekeurd</option>
                  <option value="betaald">Betaald</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="label">Categorie</label>
              <input
                type="text"
                className="input"
                placeholder="bijv. Software, Hosting, Kantoor"
                value={form.categorie}
                onChange={(e) => setForm({ ...form, categorie: e.target.value })}
              />
            </div>
            <div className="mt-4">
              <label className="label">Eigenaar</label>
              <select
                className="input"
                value={form.daan_of_wim}
                onChange={(e) => setForm({ ...form, daan_of_wim: e.target.value })}
              >
                <option value="Beiden">Beiden</option>
                <option value="Daan">Daan</option>
                <option value="Wim">Wim</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bedragen */}
        <div className="card mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Bedragen</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Subtotaal (excl. BTW)</label>
              <input
                type="number"
                className="input"
                min="0"
                step="0.01"
                value={form.subtotaal}
                onChange={(e) => handleSubtotaalChange(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="label">BTW</label>
              <input
                type="number"
                className="input"
                min="0"
                step="0.01"
                value={form.btw}
                onChange={(e) => handleBtwChange(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="label">Totaal (incl. BTW)</label>
              <input
                type="number"
                className="input bg-gray-50"
                value={form.totaal}
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Beschrijving */}
        <div className="card mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Beschrijving</h2>
          <textarea
            className="input min-h-[80px]"
            placeholder="Beschrijving of opmerkingen (optioneel)"
            value={form.beschrijving}
            onChange={(e) => setForm({ ...form, beschrijving: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Link href={`/uitgaven/${params.id}`} className="btn-secondary">
            Annuleren
          </Link>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Opslaan..." : "Wijzigingen opslaan"}
          </button>
        </div>
      </form>
    </div>
  );
}
