"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import { uploadExpense, updateExpense } from "@/lib/api";
import { Expense } from "@/types";
import {
  ACCEPTED_EXPENSE_FILES,
  formatFileSize,
  prepareExpenseUpload,
  type PreparedExpenseUpload,
} from "@/lib/expenseUpload";
import toast from "react-hot-toast";

const UPLOAD_STEPS = [
  "Bestand uploaden...",
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
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState(0);
  const [methode, setMethode] = useState<"gemini" | "regex" | null>(null);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [selectedUpload, setSelectedUpload] = useState<PreparedExpenseUpload | null>(null);
  const [editing, setEditing] = useState(false);
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    leverancier: "",
    factuurnummer: "",
    datum: "",
    categorie: "",
    beschrijving: "",
    subtotaal: 0,
    btw: 0,
    totaal: 0,
    daan_of_wim: "Beiden",
  });

  useEffect(() => {
    return () => {
      if (selectedUpload?.previewUrl) {
        URL.revokeObjectURL(selectedUpload.previewUrl);
      }
    };
  }, [selectedUpload]);

  useEffect(() => {
    return () => {
      if (stepTimerRef.current) {
        clearInterval(stepTimerRef.current);
      }
    };
  }, []);

  const selectFile = useCallback(async (file: File) => {
    if (!file) return;

    setPreparing(true);

    try {
      const preparedUpload = await prepareExpenseUpload(file);
      setSelectedUpload((current) => {
        if (current?.previewUrl) {
          URL.revokeObjectURL(current.previewUrl);
        }
        return preparedUpload;
      });
    } catch (e: any) {
      toast.error(e.message || "Bestand kon niet worden voorbereid.");
    } finally {
      setPreparing(false);
    }
  }, []);

  const handleFileUpload = useCallback(async () => {
    if (!selectedUpload?.file) return;

    setUploading(true);
    setUploadStep(0);

    // Animate through steps
    let step = 0;
    stepTimerRef.current = setInterval(() => {
      step = Math.min(step + 1, UPLOAD_STEPS.length - 1);
      setUploadStep(step);
    }, 1800);

    try {
      const result = (await uploadExpense(selectedUpload.file)) as Expense & { methode?: "gemini" | "regex" };
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
        daan_of_wim: result.daan_of_wim || "Beiden",
      });
      setEditing(true);
      setSelectedUpload((current) => {
        if (current?.previewUrl) {
          URL.revokeObjectURL(current.previewUrl);
        }
        return null;
      });
      toast.success("Bestand geüpload en uitgelezen");
    } catch (e: any) {
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }, [selectedUpload]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    await selectFile(file);
  }, [selectFile]);

  const handleCameraInput = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    await selectFile(file);
  }, [selectFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_EXPENSE_FILES,
    maxFiles: 1,
    disabled: preparing || uploading,
    onDropRejected: () => {
      toast.error("Kies een PDF, JPG, PNG, WEBP of HEIC-bestand.");
    },
  });

  const uploadedFileLabel = expense?.bestand_mime_type?.startsWith("image/")
    ? "Geüploade foto bekijken"
    : "Geüpload bestand bekijken";
  const isBusy = preparing || uploading;

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
          Upload een PDF of maak een foto van een bon of factuur. De gegevens worden automatisch uitgelezen.
        </p>
      </div>

      {!editing ? (
        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={`card cursor-pointer border-2 border-dashed transition-colors ${
              isDragActive
                ? "border-brand-400 bg-brand-50"
                : "border-gray-200 hover:border-gray-300"
            } ${isBusy ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <input {...getInputProps()} />
            <div className="py-16 text-center">
              {isBusy ? (
                <>
                  <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
                  <p className="text-sm font-medium text-gray-900">
                    {preparing ? "Foto voorbereiden voor upload..." : UPLOAD_STEPS[uploadStep]}
                  </p>
                  {!preparing && (
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
                  )}
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
                    Sleep een PDF of foto hierheen
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    of klik om een PDF, JPG, PNG, WEBP of HEIC te selecteren
                  </p>
                </>
              )}
            </div>
          </div>

          {!isBusy && (
            <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Sneller op telefoon</p>
                <p className="mt-1 text-xs text-gray-500">
                  Maak direct een foto van een bon of factuur met je camera. HEIC wordt automatisch omgezet.
                </p>
              </div>
              <>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*,.heic,.heif"
                  capture="environment"
                  className="hidden"
                  onChange={handleCameraInput}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  Foto maken
                </button>
              </>
            </div>
          )}

          {selectedUpload && !editing && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
              <div className="card overflow-hidden p-0">
                <div className="border-b border-gray-100 px-4 py-3">
                  <p className="text-sm font-medium text-gray-900">Preview</p>
                  <p className="mt-1 text-xs text-gray-500">Controleer het bestand voordat je uploadt.</p>
                </div>
                {selectedUpload.isImage && selectedUpload.previewUrl ? (
                  <div className="bg-gray-50 p-4">
                    <img
                      src={selectedUpload.previewUrl}
                      alt={selectedUpload.displayName}
                      className="mx-auto max-h-[28rem] w-full rounded-lg object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[18rem] flex-col items-center justify-center gap-3 bg-gray-50 p-6 text-center">
                    <svg className="h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <p className="text-sm font-medium text-gray-900">{selectedUpload.displayName}</p>
                    <p className="text-xs text-gray-500">PDF-preview opent na upload in een nieuw tabblad.</p>
                  </div>
                )}
              </div>

              <div className="card">
                <h2 className="text-sm font-medium text-gray-900">Bestand klaar voor upload</h2>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Origineel</span>
                    <span className="text-right font-medium text-gray-900">{selectedUpload.originalName}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Uploadbestand</span>
                    <span className="text-right font-medium text-gray-900">{selectedUpload.displayName}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Type</span>
                    <span className="text-right font-medium text-gray-900">{selectedUpload.mimeType}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-gray-500">Grootte</span>
                    <span className="text-right font-medium text-gray-900">
                      {formatFileSize(selectedUpload.originalSize)}
                      {selectedUpload.processedSize !== selectedUpload.originalSize && (
                        <span className="text-gray-500"> naar {formatFileSize(selectedUpload.processedSize)}</span>
                      )}
                    </span>
                  </div>
                </div>

                {selectedUpload.notes.length > 0 && (
                  <div className="mt-4 rounded-xl bg-gray-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Automatische optimalisatie</p>
                    <ul className="mt-2 space-y-2 text-sm text-gray-700">
                      {selectedUpload.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleFileUpload}
                    className="btn-primary"
                  >
                    Upload bestand
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setSelectedUpload((current) => {
                        if (current?.previewUrl) {
                          URL.revokeObjectURL(current.previewUrl);
                        }
                        return null;
                      });
                    }}
                  >
                    Ander bestand kiezen
                  </button>
                </div>
              </div>
            </div>
          )}
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
                  Bestand uitgelezen — controleer de gegevens
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <div className="sm:col-span-2">
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
              <div>
                <label className="label">Eigenaar</label>
                <select
                  className="input"
                  value={form.daan_of_wim}
                  onChange={(e) =>
                    setForm({ ...form, daan_of_wim: e.target.value })
                  }
                >
                  <option value="Beiden">Beiden</option>
                  <option value="Daan">Daan</option>
                  <option value="Wim">Wim</option>
                </select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
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
                {uploadedFileLabel}
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
