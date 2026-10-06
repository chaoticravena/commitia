import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  // ponytail: o phaser.esm.js (8,8 MB) vira 50 MB com source map no dev server e estoura a memória;
  // o build minificado resolve. Caminho de arquivo porque o "exports" do pacote não expõe o .min.
  // Os tipos continuam vindo de "phaser".
  resolve: {
    alias: { phaser: fileURLToPath(new URL("./node_modules/phaser/dist/phaser.esm.min.js", import.meta.url)) },
  },
  optimizeDeps: { exclude: ["phaser"] },
});
