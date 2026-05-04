import { app, BrowserWindow, Menu, ipcMain, shell } from "electron";
import * as path from "path";
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { KubernetesService } from "./services/kubernetesService";

const execFileAsync = promisify(execFile);

const isDev = process.env.NODE_ENV === "development";
const DEV_ICON_PATH = path.join(__dirname, "../build/icon.ico");
const PROD_ICON_PATH = path.join(process.resourcesPath, "icon.ico");

let mainWindow: BrowserWindow | null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    icon: isDev ? DEV_ICON_PATH : PROD_ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    const indexPath = path.join(__dirname, "../build/index.html");
    mainWindow.loadFile(indexPath).catch((err: Error) => {
      const msg = `No se pudo cargar la interfaz:\n${err.message}\n\nRuta esperada: ${indexPath}`;
      mainWindow?.loadURL(
        `data:text/html;charset=utf-8,<html><body style="font-family:monospace;padding:2rem;background:%23111;color:%23f87171"><h2>Error al iniciar KubeVista</h2><pre>${encodeURIComponent(msg)}</pre></body></html>`
      );
      console.error("Failed to load renderer:", err);
    });
  }

  // On renderer crash or unresponsive, log the details.
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer process gone:", details);
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`did-fail-load: ${errorCode} ${errorDescription} (${validatedURL})`);
    if (!isDev) {
      const msg = `Error al cargar la app (${errorCode}):\n${errorDescription}\nURL: ${validatedURL}`;
      mainWindow?.loadURL(
        `data:text/html;charset=utf-8,<html><body style="font-family:monospace;padding:2rem;background:%23111;color:%23f87171"><h2>Error al iniciar KubeVista</h2><pre>${encodeURIComponent(msg)}</pre></body></html>`
      );
    }
  });

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

type InstallTool = "azure-cli" | "kubectl" | "kubelogin" | "all";

interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

function runWindowsInstall(tool: InstallTool): { message: string } {
  const installCommands: Record<InstallTool, string> = {
    "azure-cli": "winget install --id Microsoft.AzureCLI -e --accept-package-agreements --accept-source-agreements",
    kubectl: "winget install --id Kubernetes.kubectl -e --accept-package-agreements --accept-source-agreements",
    kubelogin: "winget install --id Kubernetes.kubelogin -e --accept-package-agreements --accept-source-agreements",
    all: [
      "winget install --id Microsoft.AzureCLI -e --accept-package-agreements --accept-source-agreements",
      "winget install --id Kubernetes.kubectl -e --accept-package-agreements --accept-source-agreements",
      "winget install --id Kubernetes.kubelogin -e --accept-package-agreements --accept-source-agreements",
    ].join("; "),
  };

  const command = installCommands[tool];
  const child = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Start-Process powershell -ArgumentList '-NoExit','-Command','${command}'`,
    ],
    {
      windowsHide: true,
      detached: true,
      stdio: "ignore",
    }
  );

  child.unref();
  return {
    message: "Se abrio una terminal para ejecutar la instalacion. Revisa el progreso alli.",
  };
}

async function runTelepresenceCommand(args: string[]): Promise<CommandResult> {
  try {
    const result = await execFileAsync("telepresence", args, {
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 8,
    });

    return {
      success: true,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
    };
  } catch (error: any) {
    return {
      success: false,
      stdout: error?.stdout || "",
      stderr: error?.stderr || error?.message || "Error ejecutando telepresence",
    };
  }
}

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

ipcMain.handle("open-external-url", async (_, url: string) => {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("URL no permitida");
  }
  await shell.openExternal(url);
});

ipcMain.handle("install-tool", async (_, tool: InstallTool) => {
  if (!tool || !["azure-cli", "kubectl", "kubelogin", "all"].includes(tool)) {
    throw new Error("Herramienta de instalacion invalida");
  }

  if (process.platform !== "win32") {
    return {
      message: "La instalacion con un clic esta habilitada solo en Windows.",
    };
  }

  return runWindowsInstall(tool);
});

ipcMain.handle("telepresence-connect", async (_, clusterContext: string) => {
  if (!clusterContext || !/^[\w\-.:/]+$/.test(clusterContext)) {
    throw new Error("Contexto de cluster invalido");
  }

  return runTelepresenceCommand(["connect", "--context", clusterContext]);
});

ipcMain.handle("telepresence-status", async () => {
  return runTelepresenceCommand(["status"]);
});

ipcMain.handle("telepresence-quit", async () => {
  return runTelepresenceCommand(["quit"]);
});

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
