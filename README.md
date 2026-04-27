# Lens Alternativa 🔷

Un gestor visual de clusters Kubernetes inspirado en Lens, construido con Electron y React.

## ✨ Características

- 📊 **Visualización de Clusters**: Gestiona múltiples clusters de Kubernetes
- 📦 **Gestión de Pods**: Lista y monitorea todos tus pods
- 📝 **Logs en Tiempo Real**: Visualiza logs de pods instantáneamente
- 🔄 **Sincronización Automática**: Actualización automática de recursos
- 🎨 **Interfaz Moderna**: Interfaz limpia y responsive con Tailwind CSS
- 💾 **Almacenamiento Local**: Recuerda tus configuraciones

## 🚀 Inicio Rápido

### Requisitos Previos

- Node.js 16+ 
- npm o yarn
- kubeconfig configurado (~/.kube/config)

### Instalación

```bash
# Clonar el repositorio
git clone <repo-url>
cd lens-alternativa

# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Build para producción
npm run build
```

## 📁 Estructura del Proyecto

```
src/
├── main.ts              # Proceso principal de Electron
├── preload.ts          # Preload script seguro
├── App.tsx             # Componente raíz
├── index.tsx           # Punto de entrada
├── index.css           # Estilos globales
├── components/         # Componentes React
│   ├── Dashboard.tsx
│   ├── ClusterSelector.tsx
│   ├── NamespaceSelector.tsx
│   └── PodList.tsx
├── services/           # Servicios (Kubernetes)
│   └── kubernetesService.ts
└── store/             # Estado global (Zustand)
    └── clusterStore.ts

public/
├── index.html         # HTML template

package.json           # Dependencias y scripts
tsconfig.json         # Configuración TypeScript
tailwind.config.js    # Configuración Tailwind
```

## 🔧 Scripts Disponibles

- `npm run dev` - Inicia el servidor de desarrollo y Electron
- `npm run react-dev` - Solo servidor de desarrollo React
- `npm run electron-dev` - Solo Electron
- `npm run build` - Build para producción
- `npm run compile` - Compila TypeScript
- `npm run test` - Ejecuta pruebas

## 🛠️ Stack Tecnológico

- **Frontend**: React 18 + TypeScript
- **Desktop**: Electron 27
- **Styling**: Tailwind CSS + PostCSS
- **State Management**: Zustand
- **Kubernetes**: @kubernetes/client-node
- **Icons**: react-icons
- **Gráficos**: Recharts

## 📋 Funcionalidades Planificadas

- [ ] Historial de cambios
- [ ] Alertas y notificaciones
- [ ] Edición inline de recursos
- [ ] Búsqueda y filtrado avanzado
- [ ] Gráficos de uso de recursos
- [ ] Soporte para múltiples kubeconfigs
- [ ] Temas personalizados
- [ ] Exportación de logs

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la licencia MIT. Ver archivo `LICENSE` para más detalles.

## 📞 Soporte

Para reportar bugs o sugerir features, crea un issue en el repositorio.

---

Hecho con ❤️ para la comunidad de Kubernetes
