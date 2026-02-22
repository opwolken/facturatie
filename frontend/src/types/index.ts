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
  afschrijving: boolean;
  afschrijving_jaren: number | null;
  afschrijving_restwaarde: number | null;
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

export interface WinstVerliesBreakdownItem {
  naam: string;
  bedrag: number;
}

export interface WinstVerliesMaand {
  maand: string;
  omzet: number;
  uitgaven: number;
}

export interface WinstVerliesPersoon {
  omzet: number;
  uitgaven: number;
  winst: number;
  belasting: number;
  netto: number;
  omzet_per_klant: WinstVerliesBreakdownItem[];
  uitgaven_per_categorie: WinstVerliesBreakdownItem[];
  maandoverzicht: WinstVerliesMaand[];
}

export interface WinstVerliesData {
  jaar: number;
  beschikbare_jaren: number[];
  daan: WinstVerliesPersoon;
  wim: WinstVerliesPersoon;
}

// === Jaarcijfers ===

export interface BalansPost {
  begin: number | null;
  eind: number | null;
}

export interface JaarcijfersWinstVerlies {
  omzet: number;
  omzet_btw: number;
  kosten_direct: number;
  afschrijvingen: number;
  totaal_kosten: number;
  winst: number;
  mkb_vrijstelling: number;
  mkb_percentage: number;
  belastbare_winst: number;
  omzet_per_klant: WinstVerliesBreakdownItem[];
  kosten_per_categorie: WinstVerliesBreakdownItem[];
}

export interface JaarcijfersBalans {
  activa: {
    mva: BalansPost;
    debiteuren: BalansPost;
    liquide_middelen: BalansPost;
    totaal: BalansPost;
  };
  passiva: {
    eigen_vermogen: BalansPost;
    crediteuren: BalansPost;
    btw_schuld: BalansPost;
    kortlopend_totaal: BalansPost;
    totaal: BalansPost;
  };
}

export interface MVAItem {
  id: string;
  leverancier: string;
  beschrijving: string;
  datum: string;
  categorie: string;
  aanschafwaarde: number;
  restwaarde: number;
  jaren: number;
  jaarlijkse_afschrijving: number;
  boekwaarde_begin: number;
  boekwaarde_eind: number;
  afschrijving_dit_jaar: number;
}

export interface MVAOverzicht {
  items: MVAItem[];
  totaal_boekwaarde_begin: number;
  totaal_boekwaarde_eind: number;
  totaal_afschrijving: number;
  totaal_aanschaf_dit_jaar: number;
}

export interface JaarcijfersData {
  jaar: number;
  beschikbare_jaren: number[];
  winst_verlies: JaarcijfersWinstVerlies;
  balans: JaarcijfersBalans;
  mva: MVAOverzicht;
  bron?: "berekend" | "accountant";
}

export interface BankAccountStatus {
  account_number: string;
  account_name: string;
  min_date: string;
  max_date: string;
  transaction_count?: number;
  uploaded_at?: string;
  id?: string;
}

export interface JaarcijfersOverzicht {
  beschikbare_jaren: number[];
  jaren: Record<number, JaarcijfersData>;
  bank_status?: BankAccountStatus[];
}
