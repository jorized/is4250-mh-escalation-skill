import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The skill lives in ../skill and is imported as raw text, so the web app
// and the drop-in skill share one source of truth.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/is4250-mh-escalation-skill/",
  plugins: [react()],
  server: { fs: { allow: [".."] } },
});
