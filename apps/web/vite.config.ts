import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "github-pages-fallback",
      apply: "build",
      async closeBundle() {
        await copyFile(resolve("dist/index.html"), resolve("dist/404.html"));
      },
    },
  ],
});
