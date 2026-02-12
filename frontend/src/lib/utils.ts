export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function formatDate(date: string): string {
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  } catch {
    return date;
  }
}

export function formatDateShort(date: string): string {
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(date));
  } catch {
    return date;
  }
}

export function formatMonth(yearMonth: string): string {
  if (!yearMonth) return "";
  try {
    const [year, month] = yearMonth.split("-");
    return new Intl.DateTimeFormat("nl-NL", {
      month: "short",
      year: "numeric",
    }).format(new Date(parseInt(year), parseInt(month) - 1));
  } catch {
    return yearMonth;
  }
}

export function classNames(...classes: (string | boolean | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "concept":
      return "bg-gray-100 text-gray-700";
    case "verzonden":
      return "bg-amber-50 text-amber-700";
    case "betaald":
      return "bg-emerald-50 text-emerald-700";
    case "verlopen":
      return "bg-red-50 text-red-700";
    case "nieuw":
      return "bg-blue-50 text-blue-700";
    case "goedgekeurd":
      return "bg-emerald-50 text-emerald-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    concept: "Concept",
    verzonden: "Verzonden",
    betaald: "Betaald",
    verlopen: "Verlopen",
    nieuw: "Nieuw",
    goedgekeurd: "Goedgekeurd",
  };
  return labels[status] || status;
}

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
