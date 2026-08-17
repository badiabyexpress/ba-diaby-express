import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        /*
         * Tout partait dans un seul fichier d'un mégaoctet : à chaque mise en ligne, les agents
         * retéléchargeaient l'intégralité — React et Supabase compris — alors que seul le code
         * métier avait changé. En séparant les bibliothèques, qui ne bougent qu'aux mises à jour
         * de dépendances, leur version en cache est réutilisée d'un déploiement à l'autre.
         * Sur une 4G guinéenne, c'est plusieurs centaines de kilo-octets épargnés à chaque fois.
         */
        manualChunks: {
          react: ["react", "react-dom"],
          supabase: ["@supabase/supabase-js"],
          icones: ["lucide-react"],
        },
      },
    },
    // Avertissement de taille relevé : le gros fichier restant est le code métier lui-même
    // (un seul composant applicatif), connu et suivi — inutile de le signaler à chaque build.
    chunkSizeWarningLimit: 800,
  },
});
