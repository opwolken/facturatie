import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/components/layout/AuthProvider";
import DashboardLayout from "@/app/(dashboard)/layout";
import "@/app/globals.css";

const DashboardPage = lazy(() => import("@/app/(dashboard)/page"));
const FacturenPage = lazy(() => import("@/app/(dashboard)/facturen/page"));
const FactuurDetailPage = lazy(() => import("@/app/(dashboard)/facturen/[id]/page"));
const FactuurBewerkenPage = lazy(() => import("@/app/(dashboard)/facturen/[id]/bewerken/page"));
const FactuurNieuwPage = lazy(() => import("@/app/(dashboard)/facturen/nieuw/page"));
const MatchingPage = lazy(() => import("@/app/(dashboard)/facturen/matching/page"));
const InstellingenPage = lazy(() => import("@/app/(dashboard)/instellingen/page"));
const JaarcijfersPage = lazy(() => import("@/app/(dashboard)/jaarcijfers/page"));
const KlantenPage = lazy(() => import("@/app/(dashboard)/klanten/page"));
const KlantDetailPage = lazy(() => import("@/app/(dashboard)/klanten/[id]/page"));
const KlantNieuwPage = lazy(() => import("@/app/(dashboard)/klanten/nieuw/page"));
const UitgavenPage = lazy(() => import("@/app/(dashboard)/uitgaven/page"));
const UitgaveDetailPage = lazy(() => import("@/app/(dashboard)/uitgaven/[id]/page"));
const UitgaveBewerkenPage = lazy(() => import("@/app/(dashboard)/uitgaven/[id]/bewerken/page"));
const UitgavenUploadenPage = lazy(() => import("@/app/(dashboard)/uitgaven/uploaden/page"));
const WinstVerliesPage = lazy(() => import("@/app/(dashboard)/winst-verlies/page"));
const LoginPage = lazy(() => import("@/app/login/page"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
    </div>
  );
}

function DashboardShell() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}

function AppShell() {
  return (
    <div className="font-sans">
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<DashboardShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="facturen" element={<FacturenPage />} />
              <Route path="facturen/nieuw" element={<FactuurNieuwPage />} />
              <Route path="facturen/matching" element={<MatchingPage />} />
              <Route path="facturen/:id" element={<FactuurDetailPage />} />
              <Route path="facturen/:id/bewerken" element={<FactuurBewerkenPage />} />
              <Route path="instellingen" element={<InstellingenPage />} />
              <Route path="jaarcijfers" element={<JaarcijfersPage />} />
              <Route path="klanten" element={<KlantenPage />} />
              <Route path="klanten/nieuw" element={<KlantNieuwPage />} />
              <Route path="klanten/:id" element={<KlantDetailPage />} />
              <Route path="uitgaven" element={<UitgavenPage />} />
              <Route path="uitgaven/uploaden" element={<UitgavenUploadenPage />} />
              <Route path="uitgaven/:id" element={<UitgaveDetailPage />} />
              <Route path="uitgaven/:id/bewerken" element={<UitgaveBewerkenPage />} />
              <Route path="winst-verlies" element={<WinstVerliesPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: "12px",
              padding: "14px 20px",
              fontSize: "14px",
            },
          }}
        />
      </AuthProvider>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  </React.StrictMode>
);