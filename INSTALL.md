# 📦 Guía de Instalación - Lens Alternativa

## Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

### Node.js y npm
- **Node.js**: v16 o superior ([descargar](https://nodejs.org/))
- Verificar instalación:
  ```bash
  node --version
  npm --version
  ```

### Kubernetes CLI (kubectl)
- **kubectl**: última versión ([instalar](https://kubernetes.io/docs/tasks/tools/))
- Verificar instalación:
  ```bash
  kubectl version --client
  ```

### kubeconfig
- Archivo de configuración de Kubernetes en `~/.kube/config`
- Debe tener al menos un cluster configurado
- Verificar acceso:
  ```bash
  kubectl cluster-info
  kubectl get pods --all-namespaces
  ```

## 🚀 Instalación Paso a Paso

### 1. Clonar el Repositorio
```bash
git clone https://github.com/tu-usuario/lens-alternativa.git
cd lens-alternativa
```

### 2. Instalar Dependencias
```bash
npm install
```

Este comando instalará todas las dependencias necesarias:
- React 18
- Electron 27
- Kubernetes Client
- Tailwind CSS
- Y muchas más...

### 3. Configurar kubeconfig

#### Verificar kubeconfig existente
```bash
cat ~/.kube/config
```

#### Agregar un nuevo cluster (ejemplo)
```bash
kubectl config set-cluster micluster --server=https://192.168.1.100:6443 --certificate-authority=/path/to/ca.crt
kubectl config set-credentials miusuario --client-certificate=/path/to/client.crt --client-key=/path/to/client.key
kubectl config set-context micontexto --cluster=micluster --user=miusuario
kubectl config use-context micontexto
```

## 💻 Ejecución

### Modo Desarrollo
```bash
npm run dev
```

Esto iniciará:
- Servidor de desarrollo React en `http://localhost:3000`
- Aplicación Electron

El navegador se abrirá automáticamente con DevTools habilitadas.

### Modo Producción
```bash
npm run build
npm start
```

## 🔨 Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia desarrollo con hot reload |
| `npm run react-dev` | Solo servidor React |
| `npm run electron-dev` | Solo Electron |
| `npm run build` | Build para producción |
| `npm run compile` | Compila TypeScript |
| `npm start` | Ejecuta versión compilada |
| `npm test` | Ejecuta pruebas |

## 🏗️ Build para Distribución

### Windows
```bash
npm run build
```
Generará instaladores en la carpeta `out/`:
- `Lens Alternativa Setup.exe` - Instalador interactivo
- `Lens Alternativa.exe` - Versión portable

### macOS
```bash
npm run build
```
Generará:
- `Lens Alternativa.dmg` - Instalador
- `Lens Alternativa.zip` - Archivo comprimido

### Linux
```bash
npm run build
```
Generará:
- `lens-alternativa.AppImage` - Ejecutable
- `lens-alternativa.deb` - Paquete Debian

## 🔧 Solución de Problemas

### Error: "kubeconfig not found"
```bash
# Verificar ruta de kubeconfig
echo $KUBECONFIG

# O usar ruta default
export KUBECONFIG=~/.kube/config
npm run dev
```

### Error: "Cannot connect to cluster"
1. Verificar conexión:
   ```bash
   kubectl cluster-info
   ```

2. Verificar certificados:
   ```bash
   kubectl auth can-i get pods --all-namespaces
   ```

### Error: "Module not found"
```bash
# Limpiar node_modules e instalar nuevamente
rm -rf node_modules package-lock.json
npm install
```

### Electron no inicia
```bash
# Compilar TypeScript
npm run compile

# Intenta nuevo
npm run dev
```

### Puerto 3000 en uso
```bash
# Cambiar puerto en package.json o usar diferente
PORT=3001 npm run react-dev
```

## 📝 Configuración Avanzada

### Variables de Entorno
Crear archivo `.env.local`:
```
REACT_APP_API_TIMEOUT=30000
REACT_APP_LOG_LEVEL=debug
```

### Múltiples kubeconfigs
```bash
# Combinar kubeconfigs
export KUBECONFIG=~/.kube/config:~/.kube/config-staging:~/.kube/config-prod
npm run dev
```

## 🐛 Modo Debug

Habilitar logs detallados:
```bash
# Linux/macOS
DEBUG=* npm run dev

# Windows
$env:DEBUG="*"; npm run dev
```

## 📊 Monitorear Desarrollo

Abrir DevTools: `Ctrl+Shift+I` (Windows/Linux) o `Cmd+Option+I` (macOS)

Tabs útiles:
- **Console**: Ver logs y errores
- **Network**: Verificar llamadas a Kubernetes API
- **Storage**: Ver datos guardados localmente

## ✅ Verificación de Instalación

Una vez que todo esté configurado, verifica que funciona:

1. ✅ Aplicación se abre sin errores
2. ✅ Aparece lista de clusters
3. ✅ Puedes seleccionar un cluster
4. ✅ Aparecen namespaces disponibles
5. ✅ Puedes ver pods en cada namespace
6. ✅ Puedes ver logs de pods

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs en la consola de DevTools
2. Verifica que kubectl funciona: `kubectl get pods -A`
3. Crea un issue en GitHub con:
   - Versión de Node.js (`node --version`)
   - Versión de kubectl (`kubectl version`)
   - Logs de error completos
   - Pasos para reproducir

## 🎉 ¡Listo!

Tu instalación está completa. Ahora puedes:
- 📊 Visualizar tus clusters
- 📦 Gestionar pods
- 📝 Ver logs en tiempo real
- 🔄 Monitorear recursos

¡Disfruta usando Lens Alternativa! 🚀
