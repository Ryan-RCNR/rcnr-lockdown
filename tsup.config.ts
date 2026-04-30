import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  external: ["react", "react/jsx-runtime"],
  // Components added in 1.5.0 use TSX. Set jsx: react-jsx so the
  // automatic JSX runtime is used (no need for `import React`).
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
