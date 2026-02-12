export interface Customer {
  id: string;
  bedrijfsnaam: string;
  voornaam: string;
  achternaam: string;
  email: string;
  telefoon: string;
  adres: string;
  postcode: string;
  plaats: string;
  land: string;
  kvk_nummer: string;
  btw_nummer: string;
  notities: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLineItem {
  beschrijving: string;
  aantal: number;
  tarief: number;
  btw_percentage: number;
  totaal: number;
}

export interface Invoice {
  id: string;
  factuurnummer: string;
  klant_id: string;
  klant_naam: string;
  factuurdatum: string;
  vervaldatum: string;
  onderwerp: string;
  regels: InvoiceLineItem[];
  subtotaal: number;
  btw_totaal: number;
  totaal: number;
  status: "concept" | "verzonden" | "betaald" | "verlopen";
  notities: string;
  pdf_url: string | null;
  verzonden_op: string | null;
  betaald_op: string | null;
  daan_of_wim: "Daan" | "Wim" | "Beiden" | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  leverancier: string;
  factuurnummer: string;
  datum: string;
  categorie: string;
  beschrijving: string;
  subtotaal: number;
  btw: number;
  totaal: number;
  status: "nieuw" | "goedgekeurd" | "betaald";
  daan_of_wim: "Daan" | "Wim" | "Beiden" | null;
  pdf_url: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardData {
  jaar: number;
  beschikbare_jaren: number[];
  totaal_omzet: number;
  totaal_betaald: number;
  totaal_openstaand: number;
  totaal_uitgaven: number;
  winst: number;
  aantal_facturen: number;
  aantal_klanten: number;
  maandoverzicht: { maand: string; omzet: number; uitgaven: number }[];
  categorieën: { categorie: string; totaal: number }[];
  status_verdeling: Record<string, number>;
  recente_facturen: Invoice[];
  recente_uitgaven: Expense[];
}

export interface BtwData {
  jaar: number;
  kwartaal: number;
  omzet: number;
  omzet_btw: number;
  inkoop: number;
  inkoop_btw: number;
  verschil: number;
}

export interface WinstVerliesTotalen {
  jaar: number;
  inkomsten: number;
  uitgaven: number;
  winst: number;
}

export interface InkomstenBelasting {
  jaar: number;
  ink_daan: number;
  ink_wim: number;
  uit_daan: number;
  uit_wim: number;
  winst_daan: number;
  winst_wim: number;
  bel_daan: number;
  bel_wim: number;
}

export interface FinancieelData {
  winst_verlies: WinstVerliesTotalen;
  btw: BtwData;
  inkomstenbelasting: InkomstenBelasting;
}
