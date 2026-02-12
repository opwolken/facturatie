"use client";

import { useEffect, useState, useCallback } from "react";
import { getPreferences, savePreferences } from "@/lib/api";

interface UserPreferences {
  columns_facturen?: string[];
  columns_uitgaven?: string[];
  columns_klanten?: string[];
}

export function useColumnPreferences(tableKey: "facturen" | "uitgaven" | "klanten") {
  const [prefs, setPrefs] = useState<string[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getPreferences()
      .then((data: any) => {
        const key = `columns_${tableKey}` as keyof UserPreferences;
        if (data[key]) {
          setPrefs(data[key] as string[]);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [tableKey]);

  const save = useCallback(
    (columns: string[]) => {
      setPrefs(columns);
      const key = `columns_${tableKey}`;
      savePreferences({ [key]: columns }).catch(() => {});
    },
    [tableKey]
  );

  return { savedColumns: prefs, loaded, saveColumns: save };
}
