---
applyTo: "src/**/*.ts,src/**/*.tsx,src/**/*.js,package.json,electron-builder.json"
---
# KubeVista stack and conventions

- KubeVista is a desktop application built with Electron 27, React 18, TypeScript 4.9, Tailwind CSS, Zustand, and `@kubernetes/client-node` 0.17.
- The Electron main process starts at `src/main.ts`; the isolated bridge is `src/preload.ts`; React starts at `src/index.tsx` and `src/App.tsx`.
- Keep Kubernetes access in `src/services/`, expose it through validated IPC handlers in `src/main.ts`, mirror the bridge in `src/preload.ts`, and update `src/global.d.ts` for renderer types.
- The repository uses npm with a lockfile v3. Package scripts configure Node 20.11.0 explicitly; no `engines` field is declared. The locally observed default Node version was 22.16.0, but validation should use the repository scripts.
- Use `npm run compile` for TypeScript, `npm test -- --watchAll=false` for tests, and `npm run react-build` for the renderer production build.
- Create the Windows NSIS installer and portable executable with `npm run package:win-nsis`; generated artifacts go to ignored `out-kubevista/`.
- `kubectl` and a working kubeconfig are runtime prerequisites. Do not add another required Kubernetes CLI when the existing `kubectl` integration can implement the behavior.
- Preserve Electron context isolation and do not expose Node APIs directly to the renderer.
