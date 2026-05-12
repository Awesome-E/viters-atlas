import { resolve } from "path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

const root = resolve(__dirname, "src");
const outDir = resolve(__dirname, "dist");

export default defineConfig({
  root,
  envDir: __dirname,
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        antex: resolve(root, "antex/index.html"),
        enrollment: resolve(root, "enrollment/index.html"),
        spaces: resolve(root, "spaces/index.html"),
      },
    },
  },
  plugins: [solid()],
});
