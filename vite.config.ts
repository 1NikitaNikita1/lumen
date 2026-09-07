import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // getUserMedia requires a secure context; --host lets you test on a
    // phone over LAN via https, but plain localhost works out of the box.
    host: true,
  },
});
