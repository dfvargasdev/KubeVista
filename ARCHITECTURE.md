# 🏗️ Arquitectura de Lens Alternativa

## Visión General

Lens Alternativa es una aplicación de escritorio construida con Electron + React que proporciona una interfaz gráfica para gestionar clusters de Kubernetes.

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                  Electron Main Process                   │
│                                                           │
│  ┌────────────────┐      ┌──────────────────┐           │
│  │ IPC Handlers   │      │ Kubernetes       │           │
│  │                │──────│ Service          │           │
│  │ - getClusters  │      │                  │           │
│  │ - getPods      │      │ @kubernetes/     │           │
│  │ - getNamespace │      │ client-node      │           │
│  │ - getPodLogs   │      │                  │           │
│  └────────────────┘      └──────────────────┘           │
│                                │                         │
│                                ▼                         │
│                         ~/.kube/config                   │
└─────────────────────────────────────────────────────────┘
          ▲                                    │
          │ IPC Events                        │
          │ JSON RPC                          │ kubeconfig
          │                                   │
┌─────────────────────────────────────────────────────────┐
│              React Renderer Process                      │
│                                                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │            Components (React)                     │  │
│  │                                                   │  │
│  │  ┌────────────────┐  ┌──────────────────┐       │  │
│  │  │   Dashboard    │  │ ClusterSelector  │       │  │
│  │  ├────────────────┤  ├──────────────────┤       │  │
│  │  │ - Header       │  │ - Dropdown       │       │  │
│  │  │ - Controls Bar │  │ - Refresh button │       │  │
│  │  │ - Pod List     │  └──────────────────┘       │  │
│  │  │ - Footer       │                             │  │
│  │  └────────────────┘  ┌──────────────────┐       │  │
│  │                      │NamespaceSelector │       │  │
│  │  ┌────────────────┐  ├──────────────────┤       │  │
│  │  │   Pod List     │  │ - Select         │       │  │
│  │  ├────────────────┤  │ - Refresh button │       │  │
│  │  │ - Pod items    │  └──────────────────┘       │  │
│  │  │ - Status badge │                             │  │
│  │  │ - Logs viewer  │                             │  │
│  │  │ - Actions      │                             │  │
│  │  └────────────────┘                             │  │
│  └──────────────────────────────────────────────────┘  │
│                        ▲                                │
│                        │                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │         State Management (Zustand)               │  │
│  │                                                   │  │
│  │  ┌────────────────────────────────────────────┐ │  │
│  │  │  useClusterStore                           │ │  │
│  │  │  ├─ clusters: Cluster[]                    │ │  │
│  │  │  ├─ selectedCluster: Cluster | null        │ │  │
│  │  │  ├─ namespaces: Namespace[]                │ │  │
│  │  │  ├─ selectedNamespace: string | null       │ │  │
│  │  │  ├─ pods: Pod[]                            │ │  │
│  │  │  ├─ loading: boolean                       │ │  │
│  │  │  └─ error: string | null                   │ │  │
│  │  └────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Componentes Principales

### 1. **Electron Main Process** (`src/main.ts`)

Responsabilidades:
- Crear y gestionar ventana de aplicación
- Manejar IPC (comunicación entre procesos)
- Exponer servicios de Kubernetes de forma segura
- Crear menú de aplicación

**Métodos IPC:**
```typescript
ipcMain.handle("get-clusters", ...)
ipcMain.handle("get-pods", ...)
ipcMain.handle("get-namespaces", ...)
ipcMain.handle("get-pod-logs", ...)
```

### 2. **Kubernetes Service** (`src/services/kubernetesService.ts`)

Responsabilidades:
- Conectar a kubeconfig
- Ejecutar operaciones en clusters
- Mapear respuestas de API a interfaces

**Métodos:**
```typescript
getClusters(): Cluster[]
getNamespaces(clusterName: string): Promise<Namespace[]>
getPods(namespace: string, cluster: string): Promise<Pod[]>
getPodLogs(namespace: string, podName: string, cluster: string): Promise<string>
deletePod(namespace: string, podName: string, cluster: string): Promise<void>
```

### 3. **State Management** (`src/store/clusterStore.ts`)

Usa Zustand para gestionar estado global:
- Clusters disponibles
- Cluster seleccionado
- Namespaces
- Pods
- Estado de carga
- Errores

### 4. **Componentes React**

#### Dashboard (`src/components/Dashboard.tsx`)
- Componente raíz
- Layout principal
- Header y footer

#### ClusterSelector (`src/components/ClusterSelector.tsx`)
- Dropdown de clusters
- Botón de refrescar
- Carga inicial de clusters

#### NamespaceSelector (`src/components/NamespaceSelector.tsx`)
- Select de namespaces
- Carga dinámica según cluster
- Botón de refrescar

#### PodList (`src/components/PodList.tsx`)
- Lista de pods
- Estados coloreados
- Visualizador de logs
- Acciones (delete, etc.)

## Flujo de Datos

### 1. Cargar Clusters

```
User clicks "Dashboard"
        ↓
ClusterSelector mounts
        ↓
loadClusters() called
        ↓
window.api.getClusters() (Preload API)
        ↓
ipcRenderer.invoke("get-clusters")
        ↓
Main Process receives
        ↓
KubernetesService.getClusters()
        ↓
Read ~/.kube/config
        ↓
Return Cluster[]
        ↓
Store updated with setClusters()
        ↓
Component re-renders with clusters
```

### 2. Ver Pods

```
User selects cluster + namespace
        ↓
PodList useEffect triggers
        ↓
loadPods() called
        ↓
window.api.getPods(namespace, cluster)
        ↓
Main Process handles "get-pods"
        ↓
KubernetesService.getPods()
        ↓
API call via @kubernetes/client-node
        ↓
Parse pod items
        ↓
Return Pod[]
        ↓
Store updated with setPods()
        ↓
Pod list renders
```

### 3. Ver Logs

```
User clicks "View Logs" on pod
        ↓
handleViewLogs() called
        ↓
window.api.getPodLogs(namespace, podName, cluster)
        ↓
Main Process handles "get-pod-logs"
        ↓
Log service reads pod logs
        ↓
Return string (log content)
        ↓
Store logs in local state
        ↓
Render logs section with <pre> tag
```

## Seguridad

### Context Isolation
```typescript
// main.ts
webPreferences: {
  preload: path.join(__dirname, "preload.js"),
  nodeIntegration: false,
  contextIsolation: true,
  enableRemoteModule: false,
}
```

### Preload Script
Expone solo métodos necesarios:
```typescript
contextBridge.exposeInMainWorld("api", {
  getClusters: () => ...,
  getPods: () => ...,
  // Solo métodos safe
})
```

### IPC Handlers
- No se ejecuta node code desde renderer
- Validación en Main Process
- Manejo de errores centralizado

## Tecnologías Utilizadas

| Capa | Tecnología | Propósito |
|------|-----------|----------|
| **Desktop** | Electron 27 | Framework de aplicación |
| **Frontend** | React 18 | UI Framework |
| **Language** | TypeScript | Type safety |
| **Styling** | Tailwind CSS | Utility CSS |
| **State** | Zustand | State management |
| **Kubernetes** | @kubernetes/client-node | API de Kubernetes |
| **Icons** | react-icons | Iconos UI |
| **Build** | Electron Builder | Packaging |

## Estructura de Carpetas

```
lens-alternativa/
├── src/
│   ├── main.ts                    # Electron main process
│   ├── preload.ts                 # Preload script
│   ├── index.tsx                  # React entry point
│   ├── App.tsx                    # Root component
│   ├── index.css                  # Global styles
│   ├── global.d.ts                # Type definitions
│   ├── components/                # React components
│   │   ├── Dashboard.tsx
│   │   ├── ClusterSelector.tsx
│   │   ├── NamespaceSelector.tsx
│   │   └── PodList.tsx
│   ├── services/                  # Services
│   │   └── kubernetesService.ts
│   └── store/                     # State management
│       └── clusterStore.ts
├── public/
│   └── index.html                 # HTML template
├── dist/                          # Compiled JS (generated)
├── out/                           # Built executables (generated)
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
├── tailwind.config.js             # Tailwind config
├── postcss.config.js              # PostCSS config
├── electron-builder.json          # Electron builder config
├── README.md                      # Documentation
└── INSTALL.md                     # Installation guide
```

## Ciclo de Vida de la Aplicación

1. **Startup**
   - Electron crea la ventana principal
   - Carga preload script
   - Inicia servidor React (dev) o carga HTML (prod)

2. **Initialization**
   - React monta Dashboard
   - ClusterSelector carga clusters
   - Primera renderización

3. **User Interaction**
   - Usuario selecciona cluster
   - NamespaceSelector carga namespaces
   - PodList carga pods
   - Usuario puede ver logs, etc.

4. **Shutdown**
   - Cierra ventana → Quita evento
   - Electron app.quit() → limpia procesos

## Extensibilidad

### Agregar Nueva Funcionalidad

1. **Agregar servicio** en `src/services/`
   ```typescript
   export class MyService {
     async getMyData(): Promise<MyData[]> { ... }
   }
   ```

2. **Exponer via IPC** en `src/main.ts`
   ```typescript
   ipcMain.handle("get-my-data", async () => {
     return await myService.getMyData();
   })
   ```

3. **Exponer en Preload** en `src/preload.ts`
   ```typescript
   api.getMyData = () => ipcRenderer.invoke("get-my-data")
   ```

4. **Actualizar tipos** en `src/global.d.ts`

5. **Usar en componente** en `src/components/`
   ```typescript
   const data = await window.api.getMyData();
   ```

## Performance

- **Lazy loading**: Pods cargados bajo demanda
- **Memoization**: Componentes memorizados evitan re-renders
- **Debouncing**: Búsqueda/filtrado con debounce
- **Virtual scrolling**: Para listas largas (futuro)

## Roadmap

- [ ] Historial de cambios
- [ ] Alertas y notificaciones
- [ ] Edición inline de recursos
- [ ] Búsqueda y filtrado avanzado
- [ ] Gráficos de recursos
- [ ] Temas personalizados
- [ ] Plugins
