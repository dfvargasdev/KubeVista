# Node.js Setup para Lens Alternativa

## Ubicación de Node.js
```
C:\tools\node-v20.11.0-win-x64\
```

## Para ejecutar comandos npm en futuras sesiones:

### Opción 1: Usar ruta completa
```powershell
C:\tools\node-v20.11.0-win-x64\npm.cmd install
C:\tools\node-v20.11.0-win-x64\npm.cmd run dev
```

### Opción 2: Agregar al PATH (PowerShell)
```powershell
$env:Path += ";C:\tools\node-v20.11.0-win-x64"
npm --version
```

### Opción 3: Usar el script bat (Windows)
```batch
npm.bat install
npm.bat run dev
```

## Versiones instaladas
- Node.js: v20.11.0
- npm: 10.2.4
- Packages instalados: 1613

## Próximos pasos
1. Para desarrollo: `npm run dev`
2. Para build: `npm run build`
3. Para testing: `npm test`

## Notas
- Las dependencias ya están instaladas en `node_modules/`
- Se usó `--legacy-peer-deps` debido a conflictos de dependencias con react-scripts
- Versión de @kubernetes/client-node es 0.17.0 (versión estable compatible)
