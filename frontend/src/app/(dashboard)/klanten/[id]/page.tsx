"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getCustomer, updateCustomer } from "@/lib/api";
import { Customer } from "@/types";
import toast from "react-hot-toast";

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    bedrijfsnaam: "",
    voornaam: "",
    achternaam: "",
    email: "",
    telefoon: "",
    adres: "",
    postcode: "",
    plaats: "",
    land: "Nederland",
    kvk_nummer: "",
    btw_nummer: "",
    notities: "",
  });

  useEffect(() => {
    getCustomer(params.id as string)
      .then((data) => {
        const c = data as Customer;
        setForm({
          bedrijfsnaam: c.bedrijfsnaam || "",
          voornaam: c.voornaam || "",
          achternaam: c.achternaam || "",
          email: c.email || "",
          telefoon: c.telefoon || "",
          adres: c.adres || "",
          postcode: c.postcode || "",
          plaats: c.plaats || "",
          land: c.land || "Nederland",
          kvk_nummer: c.kvk_nummer || "",
          btw_nummer: c.btw_nummer || "",
          notities: c.notities || "",
        });
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bedrijfsnaam.trim()) {
      toast.error("Bedrijfsnaam is verplicht");
      return;
    }

    setSaving(true);
    try {
      await updateCustomer(params.id as string, form);
      toast.success("Klant bijgewerkt");
      router.push("/klanten");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string) =>
    setForm({ ...form, [field]: value });

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
          href="/klanten"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          &larr; Terug naar klanten
        </Link>
        <h1 className="font-serif text-3xl text-gray-900">Klant bewerken</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="card mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Bedrijfsgegevens
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Bedrijfsnaam *</label>
              <input
                type="text"
                className="input"
                value={form.bedrijfsnaam}
                onChange={(e) => update("bedrijfsnaam", e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Voornaam</label>
              <input
                type="text"
                className="input"
                value={form.voornaam}
                onChange={(e) => update("voornaam", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Achternaam</label>
              <input
                type="text"
                className="input"
                value={form.achternaam}
                onChange={(e) => update("achternaam", e.target.value)}
              />
            </div>
            <div>
              <label className="label">E-mail</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Telefoon</label>
              <input
                type="tel"
                className="input"
                value={form.telefoon}
                onChange={(e) => update("telefoon", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Adres</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Adres</label>
              <input
                type="text"
                className="input"
                value={form.adres}
                onChange={(e) => update("adres", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Postcode</label>
              <input
                type="text"
                className="input"
                value={form.postcode}
                onChange={(e) => update("postcode", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Plaats</label>
              <input
                type="text"
                className="input"
                value={form.plaats}
                onChange={(e) => update("plaats", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Land</label>
              <input
                type="text"
                className="input"
                value={form.land}
                onChange={(e) => update("land", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Zakelijke gegevens
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">KVK-nummer</label>
              <input
                type="text"
                className="input"
                value={form.kvk_nummer}
                onChange={(e) => update("kvk_nummer", e.target.value)}
              />
            </div>
            <div>
              <label className="label">BTW-nummer</label>
              <input
                type="text"
                className="input"
                placeholder="NL000000000B00"
                value={form.btw_nummer}
                onChange={(e) => update("btw_nummer", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card mb-8">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Notities</h2>
          <textarea
            className="input min-h-[80px]"
            placeholder="Interne notities over deze klant (optioneel)"
            value={form.notities}
            onChange={(e) => update("notities", e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Link href="/klanten" className="btn-secondary">
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
