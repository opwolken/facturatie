"use client";

import { useEffect, useState } from "react";
import { getIdToken } from "@/lib/firebase";
import toast from "react-hot-toast";

interface CompanySettings {
  bedrijfsnaam: string;
  adres: string;
  postcode: string;
  plaats: string;
  kvk_nummer: string;
  btw_nummer: string;
  iban: string;
  email: string;
  telefoon: string;
  website: string;
  factuur_prefix: string;
}

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CompanySettings>({
    bedrijfsnaam: "",
    adres: "",
    postcode: "",
    plaats: "",
    kvk_nummer: "",
    btw_nummer: "",
    iban: "",
    email: "",
    telefoon: "",
    website: "",
    factuur_prefix: "F",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = await getIdToken();
      const res = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setForm((prev) => ({ ...prev, ...data }));
      }
    } catch {
      // Settings don't exist yet, that's fine
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await getIdToken();
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Opslaan mislukt");
      toast.success("Instellingen opgeslagen");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: string) =>
    setForm({ ...form, [field]: value });

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-gray-900">Instellingen</h1>
        <p className="mt-1 text-sm text-gray-500">
          Bedrijfsgegevens voor op je facturen
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="card mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Bedrijfsgegevens
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Bedrijfsnaam</label>
              <input
                type="text"
                className="input"
                value={form.bedrijfsnaam}
                onChange={(e) => update("bedrijfsnaam", e.target.value)}
              />
            </div>
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
          </div>
        </div>

        <div className="card mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">Contact</h2>
          <div className="grid grid-cols-2 gap-4">
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
            <div className="col-span-2">
              <label className="label">Website</label>
              <input
                type="text"
                className="input"
                placeholder="https://opwolken.com"
                value={form.website}
                onChange={(e) => update("website", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="card mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">
            Financieel
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
            <div>
              <label className="label">IBAN</label>
              <input
                type="text"
                className="input"
                placeholder="NL00 BANK 0000 0000 00"
                value={form.iban}
                onChange={(e) => update("iban", e.target.value)}
              />
            </div>
            <div>
              <label className="label">Factuur prefix</label>
              <input
                type="text"
                className="input"
                placeholder="F"
                value={form.factuur_prefix}
                onChange={(e) => update("factuur_prefix", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Opslaan..." : "Instellingen opslaan"}
          </button>
        </div>
      </form>
    </div>
  );
}
