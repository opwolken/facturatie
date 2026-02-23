"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  runBankMatching,
  manualMatch,
  partialPaymentMatch,
  getMatchSuggestions,
  getMatchingStatus,
  unmatchInvoice,
  getAvailableTransactions,
} from "@/lib/api";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import toast from "react-hot-toast";

interface MatchedTransaction {
  id: string;
  datum: string;
  bedrag: number;
  omschrijving: string;
  tegenrekening?: string;
  mededelingen?: string;
  score?: number;
}

interface MatchResult {
  invoice_id: string;
  factuurnummer: string;
  klant_naam: string;
  onderwerp: string;
  factuurdatum: string;
  totaal: number;
  status: "matched" | "partial" | "unmatched";
  matched_transactions: MatchedTransaction[];
  suggestions: MatchedTransaction[];
  matched_amount: number;
  remaining_amount: number;
}

interface MatchingSummary {
  total_matchable: number;
  auto_matched: number;
  unmatched: number;
  iban_updates: number;
}

interface MatchingStatusData {
  total_invoices: number;
  matched: number;
  matchable: number;
  betaald_met_datum: number;
  verzonden: number;
}

export default function BankMatchingPage() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<MatchingStatusData | null>(null);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [summary, setSummary] = useState<MatchingSummary | null>(null);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [selectedTransactions, setSelectedTransactions] = useState<
    Record<string, Set<string>>
  >({});
  const [partialMode, setPartialMode] = useState<Record<string, boolean>>({});
  const [matchingInvoice, setMatchingInvoice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<Record<string, MatchedTransaction[]>>({});
  const [searchLoading, setSearchLoading] = useState<Record<string, boolean>>({});

  const loadStatus = useCallback(async () => {
    try {
      const data = (await getMatchingStatus()) as MatchingStatusData;
      setStatus(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleRunMatching = async () => {
    setRunning(true);
    try {
      const data = (await runBankMatching()) as {
        results: MatchResult[];
        summary: MatchingSummary;
      };
      setResults(data.results);
      setSummary(data.summary);

      if (data.summary.auto_matched > 0) {
        toast.success(
          `${data.summary.auto_matched} facturen automatisch gekoppeld`
        );
      }
      if (data.summary.iban_updates > 0) {
        toast.success(
          `${data.summary.iban_updates} klant IBAN's bijgewerkt`
        );
      }
      if (data.summary.unmatched > 0) {
        toast(
          `${data.summary.unmatched} facturen vereisen handmatige koppeling`,
          { icon: "⚠️" }
        );
      }

      await loadStatus();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  const toggleTransaction = (invoiceId: string, txId: string) => {
    setSelectedTransactions((prev) => {
      const current = new Set(prev[invoiceId] || []);
      if (current.has(txId)) {
        current.delete(txId);
      } else {
        current.add(txId);
      }
      return { ...prev, [invoiceId]: current };
    });
  };

  const handleManualMatch = async (invoiceId: string) => {
    const txIds = Array.from(selectedTransactions[invoiceId] || []);
    if (txIds.length === 0) {
      toast.error("Selecteer minimaal één transactie");
      return;
    }

    setMatchingInvoice(invoiceId);
    try {
      const isPartial = partialMode[invoiceId];
      if (isPartial) {
        await partialPaymentMatch(invoiceId, txIds);
        toast.success("Deelbetaling gekoppeld");
      } else {
        await manualMatch(invoiceId, txIds);
        toast.success("Factuur gekoppeld");
      }

      // Remove from results
      setResults((prev) =>
        prev.map((r) =>
          r.invoice_id === invoiceId
            ? { ...r, status: "matched" as const }
            : r
        )
      );
      setExpandedInvoice(null);
      setSelectedTransactions((prev) => {
        const next = { ...prev };
        delete next[invoiceId];
        return next;
      });
      await loadStatus();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setMatchingInvoice(null);
    }
  };

  const handleLoadMoreSuggestions = async (invoiceId: string) => {
    try {
      const data = (await getMatchSuggestions(invoiceId)) as {
        suggestions: MatchedTransaction[];
      };
      setResults((prev) =>
        prev.map((r) =>
          r.invoice_id === invoiceId
            ? { ...r, suggestions: data.suggestions }
            : r
        )
      );
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleSearchTransactions = async (invoiceId: string, query: string) => {
    setSearchQuery((prev) => ({ ...prev, [invoiceId]: query }));
    if (!query.trim()) {
      setSearchResults((prev) => ({ ...prev, [invoiceId]: [] }));
      return;
    }
    setSearchLoading((prev) => ({ ...prev, [invoiceId]: true }));
    try {
      const data = (await getAvailableTransactions(query)) as {
        transactions: MatchedTransaction[];
        total: number;
      };
      setSearchResults((prev) => ({ ...prev, [invoiceId]: data.transactions }));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSearchLoading((prev) => ({ ...prev, [invoiceId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    );
  }

  const unmatchedResults = results.filter((r) => r.status === "unmatched");
  const matchedResults = results.filter((r) => r.status === "matched");

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-gray-900">
            Bank Matching
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Koppel banktransacties aan facturen voor betaaldata en IBAN's
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/facturen" className="btn-secondary">
            ← Facturen
          </Link>
          <button
            onClick={handleRunMatching}
            disabled={running}
            className="btn-primary"
          >
            {running ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Bezig...
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                  />
                </svg>
                Matching starten
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status overview */}
      {status && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="card">
            <p className="text-sm text-gray-500">Totaal facturen</p>
            <p className="text-2xl font-semibold text-gray-900">
              {status.total_invoices}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Betaald met datum</p>
            <p className="text-2xl font-semibold text-green-600">
              {status.betaald_met_datum}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Gekoppeld via bank</p>
            <p className="text-2xl font-semibold text-blue-600">
              {status.matched}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500">Nog te koppelen</p>
            <p className="text-2xl font-semibold text-amber-600">
              {status.matchable}
            </p>
          </div>
        </div>
      )}

      {/* Summary after running */}
      {summary && (
        <div className="mb-6 card bg-blue-50 border-blue-200">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            Resultaat matching
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <span className="text-blue-700">Te matchen:</span>{" "}
              <strong>{summary.total_matchable}</strong>
            </div>
            <div>
              <span className="text-green-700">Automatisch:</span>{" "}
              <strong>{summary.auto_matched}</strong>
            </div>
            <div>
              <span className="text-amber-700">Handmatig:</span>{" "}
              <strong>{summary.unmatched}</strong>
            </div>
            <div>
              <span className="text-purple-700">IBAN updates:</span>{" "}
              <strong>{summary.iban_updates}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Auto-matched invoices */}
      {matchedResults.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-3">
            Automatisch gekoppeld ({matchedResults.length})
          </h2>
          <div className="card overflow-hidden p-0">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Factuur
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Klant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Onderwerp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Factuurdatum
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Bedrag
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Betaaldatum
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    IBAN
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {matchedResults.map((r) => (
                  <tr key={r.invoice_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {r.factuurnummer}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {r.klant_naam || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {r.onderwerp || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDateShort(r.factuurdatum)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {formatCurrency(r.totaal)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {r.matched_transactions[0]
                        ? formatDateShort(r.matched_transactions[0].datum)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                      {r.matched_transactions[0]?.tegenrekening || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unmatched invoices */}
      {unmatchedResults.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-3">
            Handmatig koppelen ({unmatchedResults.length})
          </h2>
          <div className="space-y-3">
            {unmatchedResults.map((result) => {
              const isExpanded = expandedInvoice === result.invoice_id;
              const selected = selectedTransactions[result.invoice_id] || new Set();
              const isPartial = partialMode[result.invoice_id] || false;
              const selectedAmount = result.suggestions
                .filter((s) => selected.has(s.id))
                .reduce((sum, s) => sum + Math.abs(s.bedrag), 0);

              return (
                <div key={result.invoice_id} className="card">
                  {/* Invoice header */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => {
                      setExpandedInvoice(isExpanded ? null : result.invoice_id);
                      if (!isExpanded && result.suggestions.length === 0) {
                        handleLoadMoreSuggestions(result.invoice_id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {result.factuurnummer}
                        </span>
                        <span className="ml-2 text-sm text-gray-500">
                          {result.klant_naam}
                        </span>
                      </div>
                      <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400">
                        {result.onderwerp && (
                          <span className="bg-gray-100 px-2 py-0.5 rounded">
                            {result.onderwerp}
                          </span>
                        )}
                        {result.factuurdatum && (
                          <span>
                            {formatDateShort(result.factuurdatum)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(result.totaal)}
                      </span>
                      <svg
                        className={`h-5 w-5 text-gray-400 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Suggestions dropdown */}
                  {isExpanded && (
                    <div className="mt-4 border-t pt-4">
                      {/* Partial payment toggle */}
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm text-gray-500">
                          Selecteer de juiste banktransactie(s):
                        </p>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={isPartial}
                            onChange={() =>
                              setPartialMode((prev) => ({
                                ...prev,
                                [result.invoice_id]:
                                  !prev[result.invoice_id],
                              }))
                            }
                            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                          <span className="text-gray-600">
                            Deelbetaling (meerdere transacties)
                          </span>
                        </label>
                      </div>

                      {result.suggestions.length === 0 ? (
                        <p className="text-sm text-gray-400 py-4 text-center">
                          Geen suggesties gevonden. Mogelijk zijn er geen
                          bijpassende banktransacties beschikbaar.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {result.suggestions.map((tx) => {
                            const isSelected = selected.has(tx.id);
                            const amountMatch =
                              Math.abs(
                                Math.abs(tx.bedrag) - result.totaal
                              ) < 0.05;

                            return (
                              <div
                                key={tx.id}
                                onClick={() =>
                                  isPartial
                                    ? toggleTransaction(
                                        result.invoice_id,
                                        tx.id
                                      )
                                    : setSelectedTransactions((prev) => ({
                                        ...prev,
                                        [result.invoice_id]: new Set([
                                          tx.id,
                                        ]),
                                      }))
                                }
                                className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                                  isSelected
                                    ? "border-brand-500 bg-brand-50"
                                    : "border-gray-200 hover:border-gray-300"
                                }`}
                              >
                                <input
                                  type={isPartial ? "checkbox" : "radio"}
                                  name={`match-${result.invoice_id}`}
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900">
                                      {formatDateShort(tx.datum)}
                                    </span>
                                    <span
                                      className={`text-sm font-semibold ${
                                        amountMatch
                                          ? "text-green-600"
                                          : "text-gray-900"
                                      }`}
                                    >
                                      {formatCurrency(Math.abs(tx.bedrag))}
                                    </span>
                                    {amountMatch && (
                                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                        Bedrag klopt
                                      </span>
                                    )}
                                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                      Score: {tx.score}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 truncate">
                                    {tx.omschrijving}
                                  </p>
                                  {tx.mededelingen && (
                                    <p className="text-xs text-gray-400 truncate mt-0.5">
                                      {tx.mededelingen}
                                    </p>
                                  )}
                                  {tx.tegenrekening && (
                                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                                      IBAN: {tx.tegenrekening}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Searchable transactions table */}
                      <div className="mt-4 border-t pt-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Niet gevonden? Zoek in alle beschikbare transacties:
                        </p>
                        <input
                          type="text"
                          placeholder="Zoek op bedrag, naam, IBAN, datum..."
                          value={searchQuery[result.invoice_id] || ""}
                          onChange={(e) =>
                            handleSearchTransactions(result.invoice_id, e.target.value)
                          }
                          onClick={(e) => e.stopPropagation()}
                          className="input mb-3"
                        />
                        {searchLoading[result.invoice_id] && (
                          <div className="flex justify-center py-3">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600" />
                          </div>
                        )}
                        {(searchResults[result.invoice_id]?.length ?? 0) > 0 && (
                          <div className="max-h-64 overflow-y-auto space-y-2">
                            {searchResults[result.invoice_id].map((tx) => {
                              const isSelected = selected.has(tx.id);
                              const amountMatch =
                                Math.abs(Math.abs(tx.bedrag) - result.totaal) < 0.05;
                              return (
                                <div
                                  key={tx.id}
                                  onClick={() =>
                                    isPartial
                                      ? toggleTransaction(result.invoice_id, tx.id)
                                      : setSelectedTransactions((prev) => ({
                                          ...prev,
                                          [result.invoice_id]: new Set([tx.id]),
                                        }))
                                  }
                                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                                    isSelected
                                      ? "border-brand-500 bg-brand-50"
                                      : "border-gray-200 hover:border-gray-300"
                                  }`}
                                >
                                  <input
                                    type={isPartial ? "checkbox" : "radio"}
                                    name={`search-match-${result.invoice_id}`}
                                    checked={isSelected}
                                    onChange={() => {}}
                                    className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-900">
                                        {formatDateShort(tx.datum)}
                                      </span>
                                      <span
                                        className={`text-sm font-semibold ${
                                          amountMatch ? "text-green-600" : "text-gray-900"
                                        }`}
                                      >
                                        {formatCurrency(Math.abs(tx.bedrag))}
                                      </span>
                                      {amountMatch && (
                                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                          Bedrag klopt
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-600 truncate">
                                      {tx.omschrijving}
                                    </p>
                                    {tx.mededelingen && (
                                      <p className="text-xs text-gray-400 truncate mt-0.5">
                                        {tx.mededelingen}
                                      </p>
                                    )}
                                    {tx.tegenrekening && (
                                      <p className="text-xs text-gray-400 font-mono mt-0.5">
                                        IBAN: {tx.tegenrekening}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {searchQuery[result.invoice_id]?.trim() &&
                          !searchLoading[result.invoice_id] &&
                          (searchResults[result.invoice_id]?.length ?? 0) === 0 && (
                          <p className="text-sm text-gray-400 py-2 text-center">
                            Geen transacties gevonden voor &quot;{searchQuery[result.invoice_id]}&quot;
                          </p>
                        )}
                      </div>

                      {/* Selected summary & confirm */}
                      {selected.size > 0 && (
                        <div className="mt-4 flex items-center justify-between border-t pt-4">
                          <div className="text-sm text-gray-600">
                            {isPartial ? (
                              <>
                                <span>
                                  {selected.size} transactie(s) geselecteerd
                                </span>
                                <span className="ml-2 font-semibold">
                                  Totaal: {formatCurrency(selectedAmount)}
                                </span>
                                {selectedAmount < result.totaal && (
                                  <span className="ml-2 text-amber-600">
                                    (Resterend:{" "}
                                    {formatCurrency(
                                      result.totaal - selectedAmount
                                    )}
                                    )
                                  </span>
                                )}
                              </>
                            ) : (
                              <span>1 transactie geselecteerd</span>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              handleManualMatch(result.invoice_id)
                            }
                            disabled={matchingInvoice === result.invoice_id}
                            className="btn-primary text-sm"
                          >
                            {matchingInvoice === result.invoice_id ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                              "Koppelen"
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && !summary && (
        <div className="card text-center py-12">
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
              d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Bank Matching
          </h3>
          <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
            Upload eerst een ING CSV-bestand via{" "}
            <Link
              href="/jaarcijfers"
              className="text-brand-600 hover:text-brand-700"
            >
              Jaarcijfers
            </Link>
            , en klik dan op &quot;Matching starten&quot; om facturen
            automatisch te koppelen aan banktransacties.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Hiermee worden betaaldata en IBAN's automatisch ingevuld.
          </p>
        </div>
      )}
    </div>
  );
}
