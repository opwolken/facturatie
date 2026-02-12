"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { onAuthChange, signOut, User } from "@/lib/firebase";

const ALLOWED_EMAILS = ["wim@opwolken.com", "daan@opwolken.com"];

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      // Check of het e-mailadres is toegestaan
      if (firebaseUser && !ALLOWED_EMAILS.includes(firebaseUser.email?.toLowerCase() || "")) {
        await signOut();
        setUser(null);
        setLoading(false);
        if (pathname !== "/login") {
          router.push("/login");
        }
        return;
      }

      setUser(firebaseUser);
      setLoading(false);

      if (!firebaseUser && pathname !== "/login") {
        router.push("/login");
      }
      if (firebaseUser && pathname === "/login") {
        router.push("/");
      }
    });

    return unsubscribe;
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
