import { app, BrowserWindow, Menu, ipcMain } from "electron";
import * as path from "path";
import { KubernetesService } from "./services/kubernetesService";

const isDev = process.env.NODE_ENV === "development";

let mainWindow: BrowserWindow | null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const startUrl = isDev
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "../build/index.html")}`;

  mainWindow.loadURL(startUrl);

  // Open DevTools only when explicitly requested.
  if (isDev && process.env.OPEN_DEVTOOLS === "true") {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers for Kubernetes operations
const kubeService = new KubernetesService();

ipcMain.handle("get-clusters", async () => {
  try {
    return await kubeService.getClusters();
  } catch (error) {
    console.error("Error getting clusters:", error);
    throw error;
  }
});

ipcMain.handle("get-pods", async (_, namespace: string, cluster: string) => {
  try {
    return await kubeService.getPods(namespace, cluster);
  } catch (error) {
    console.error("Error getting pods:", error);
    throw error;
  }
});

ipcMain.handle("get-namespaces", async (_, cluster: string) => {
  try {
    return await kubeService.getNamespaces(cluster);
  } catch (error) {
    console.error("Error getting namespaces:", error);
    throw error;
  }
});

ipcMain.handle("get-pod-logs", async (_, namespace: string, podName: string, cluster: string) => {
  try {
    return await kubeService.getPodLogs(namespace, podName, cluster);
  } catch (error) {
    console.error("Error getting pod logs:", error);
    throw error;
  }
});

ipcMain.handle("delete-pod", async (_, namespace: string, podName: string, cluster: string) => {
  try {
    return await kubeService.deletePod(namespace, podName, cluster);
  } catch (error) {
    console.error("Error deleting pod:", error);
    throw error;
  }
});

ipcMain.handle("get-pod-containers", async (_, namespace: string, podName: string, cluster: string) => {
  try {
    return await kubeService.getPodContainers(namespace, podName, cluster);
  } catch (error) {
    console.error("Error getting pod containers:", error);
    throw error;
  }
});

ipcMain.handle(
  "exec-pod-command",
  async (
    _,
    namespace: string,
    podName: string,
    containerName: string,
    cluster: string,
    command: string
  ) => {
    try {
      return await kubeService.execPodCommand(namespace, podName, containerName, cluster, command);
    } catch (error) {
      console.error("Error executing pod command:", error);
      throw error;
    }
  }
);

ipcMain.handle("get-configmaps", async (_, namespace: string, cluster: string) => {
  try {
    return await kubeService.getConfigMaps(namespace, cluster);
  } catch (error) {
    console.error("Error getting configmaps:", error);
    throw error;
  }
});

ipcMain.handle(
  "update-configmap",
  async (_, namespace: string, name: string, data: Record<string, string>, cluster: string) => {
    try {
      await kubeService.updateConfigMap(namespace, name, data, cluster);
    } catch (error) {
      console.error("Error updating configmap:", error);
      throw error;
    }
  }
);

// Menu
const template: Electron.MenuItemConstructorOptions[] = [
  {
    label: "File",
    submenu: [
      { role: "quit" },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
    ],
  },
  {
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
    ],
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
