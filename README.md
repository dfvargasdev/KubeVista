# Lens Alternativa 🔷

Un gestor visual de clusters Kubernetes inspirado en Lens, construido con Electron y React.

## Logs agregados por servicio

Desde la acción **Logs del servicio** de un pod se pueden consultar en una sola vista los logs de todas las réplicas de su mismo workload (Deployment, StatefulSet, DaemonSet u otro controlador). No se incluyen pods de otros servicios del namespace. Cada línea indica el origen `[pod/contenedor]`; además, se puede buscar, mostrar solo coincidencias y descargar el resultado completo en un archivo `.log`.

La consulta usa `kubectl`, respeta el límite de líneas seleccionado y ejecuta como máximo cuatro lecturas simultáneas. No requiere instalar Stern.

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
- `npm run package:win-nsis` - Genera instalador NSIS y ejecutable portable para Windows

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

## Port-forward de pods

Los pods que declaran puertos TCP muestran una accion de enlace en la lista. Desde alli se
puede seleccionar un puerto —por ejemplo, `pgadmin: 80/TCP`—, elegir el puerto local,
iniciar `kubectl port-forward`, abrir la URL local y detener la sesion. KubeVista publica
el puerto exclusivamente en `127.0.0.1` y cierra todos los port-forwards al salir de la
aplicacion. El puerto local sugerido por defecto es `8888`, pero se puede editar antes de
iniciar la sesion.

## Vista multi-namespace y accesos globales

El selector de namespaces permite escribir, agregar y quitar varios valores mediante
etiquetas. La vista de pods combina los resultados de todos los namespaces seleccionados y
mantiene cada accion asociada al namespace real del pod. El buscador de pods tambien permite
guardar varios nombres o prefijos de servicio y muestra las coincidencias de cualquiera de
ellos.

El header permanece visible en toda la aplicacion. Incluye el acceso a `az login` y un
indicador de Telepresence que se actualiza periodicamente: verde cuando existe una conexion
activa y rojo cuando esta desconectado o no disponible. Al pulsar el indicador verde se cierra
la conexion; al pulsarlo en rojo se abre la vista de Telepresence para elegir el contexto.

---

Hecho con ❤️ para la comunidad de Kubernetes
