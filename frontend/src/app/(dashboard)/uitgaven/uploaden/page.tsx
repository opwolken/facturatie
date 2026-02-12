"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { uploadExpense, updateExpense } from "@/lib/api";
import { Expense } from "@/types";
import { formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";

const UPLOAD_STEPS = [
  "PDF uploaden...",
  "Analyseren met AI...",
  "Gegevens verwerken...",
];

const CATEGORIES = [
  "Software & Licenties",
  "Kantoorkosten",
  "Hosting & Domein",
  "Telefoon & Internet",
  "Reiskosten",
  "Marketing",
  "Verzekering",
  "Accountant",
  "Overig",
];

export default function UploadExpensePage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const [methode, setMethode] = useState<"gemini" | "regex" | null>(null);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [editing, setEditing] = useState(false);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [form, setForm] = useState({
    leverancier: "",
    factuurnummer: "",
    datum: "",
    categorie: "",
    beschrijving: "",
    subtotaal: 0,
    btw: 0,
    totaal: 0,
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploading(true);
    setUploadStep(0);

    // Animate through steps
    let step = 0;
    stepTimerRef.current = setInterval(() => {
      step = Math.min(step + 1, UPLOAD_STEPS.length - 1);
      setUploadStep(step);
    }, 1800);

    try {
      const result = (await uploadExpense(file)) as Expense & { methode?: "gemini" | "regex" };
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      setExpense(result);
      setMethode(result.methode || "regex");
      setForm({
        leverancier: result.leverancier || "",
        factuurnummer: result.factuurnummer || "",
        datum: result.datum || "",
        categorie: result.categorie || "",
        beschrijving: result.beschrijving || "",
        subtotaal: result.subtotaal || 0,
        btw: result.btw || 0,
        totaal: result.totaal || 0,
      });
      setEditing(true);
      toast.success("PDF geüpload en uitgelezen");
    } catch (e: any) {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: uploading,
  });

  const handleSave = async () => {
    if (!expense) return;
    try {
      await updateExpense(expense.id, { ...form, status: "goedgekeurd" });
      toast.success("Uitgave opgeslagen");
      router.push("/uitgaven");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/uitgaven"
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          &larr; Terug naar uitgaven
        </Link>
        <h1 className="font-serif text-3xl text-gray-900">
          Uitgave uploaden
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload een PDF-factuur. De gegevens worden automatisch uitgelezen.
        </p>
      </div>

      {!editing ? (
        <div
          {...getRootProps()}
          className={`card cursor-pointer border-2 border-dashed transition-colors ${
            isDragActive
              ? "border-brand-400 bg-brand-50"
              : "border-gray-200 hover:border-gray-300"
          } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input {...getInputProps()} />
          <div className="py-16 text-center">
            {uploading ? (
              <>
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
                <p className="text-sm font-medium text-gray-900">
                  {UPLOAD_STEPS[uploadStep]}
                </p>
                <div className="mt-3 flex justify-center gap-1.5">
                  {UPLOAD_STEPS.map((_, i) => (
                    <span
                      key={i}
                      className={`inline-block h-1.5 w-6 rounded-full transition-colors duration-500 ${
                        i <= uploadStep ? "bg-gray-800" : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
              </>
            ) : (
              <>
                <svg
                  className="mx-auto h-12 w-12 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <p className="mt-4 text-sm font-medium text-gray-900">
                  Sleep een PDF hierheen
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  of klik om een bestand te selecteren
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="card mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-900">
                  PDF uitgelezen — controleer de gegevens
                </span>
              </div>
              {methode === "gemini" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L9.5 9H2l5.9 4.3L5.4 20 12 15.7 18.6 20l-2.5-6.7L22 9h-7.5z" />
                  </svg>
                  Gemini AI
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                  </svg>
                  Regex
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Leverancier</label>
                <input
                  type="text"
                  className="input"
                  value={form.leverancier}
                  onChange={(e) =>
                    setForm({ ...form, leverancier: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Factuurnummer</label>
                <input
                  type="text"
                  className="input"
                  value={form.factuurnummer}
                  onChange={(e) =>
                    setForm({ ...form, factuurnummer: e.target.value })
                  }
                />
              </div>
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
                <label className="label">Categorie</label>
                <select
                  className="input"
                  value={form.categorie}
                  onChange={(e) =>
                    setForm({ ...form, categorie: e.target.value })
                  }
                >
                  <option value="">Selecteer categorie...</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Omschrijving</label>
                <input
                  type="text"
                  className="input"
                  value={form.beschrijving}
                  onChange={(e) =>
                    setForm({ ...form, beschrijving: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4">
              <div>
                <label className="label">Subtotaal (excl. BTW)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={form.subtotaal}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      subtotaal: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <label className="label">BTW</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={form.btw}
                  onChange={(e) =>
                    setForm({ ...form, btw: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <label className="label">Totaal (incl. BTW)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  value={form.totaal}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      totaal: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          </div>

          {expense?.pdf_url && (
            <div className="card mb-6">
              <a
                href={expense.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Geüploade PDF bekijken
              </a>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Link href="/uitgaven" className="btn-secondary">
              Annuleren
            </Link>
            <button onClick={handleSave} className="btn-primary">
              Uitgave opslaan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
