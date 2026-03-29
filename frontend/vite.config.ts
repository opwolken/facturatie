import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "next/link": path.resolve(__dirname, "src/compat/next-link.tsx"),
        "next/navigation": path.resolve(__dirname, "src/compat/next-navigation.ts"),
      },
    },
    define: {
      "process.env": JSON.stringify(env),
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
    },
    build: {
      outDir: "out",
      emptyOutDir: true,
    },
  };
});