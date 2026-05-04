import { ipcRenderer, contextBridge } from "electron";

interface IpcApi {
  getClusters: () => Promise<any>;
  getPods: (namespace: string, cluster: string) => Promise<any>;
  getNamespaces: (cluster: string) => Promise<any>;
  getPodLogs: (namespace: string, podName: string, cluster: string) => Promise<string>;
  deletePod: (namespace: string, podName: string, cluster: string) => Promise<void>;
  getPodContainers: (namespace: string, podName: string, cluster: string) => Promise<string[]>;
  getConfigMaps: (namespace: string, cluster: string) => Promise<any[]>;
  updateConfigMap: (namespace: string, name: string, data: Record<string, string>, cluster: string) => Promise<void>;
  execPodCommand: (
    namespace: string,
    podName: string,
    containerName: string,
    cluster: string,
    command: string
  ) => Promise<{ success: boolean; stdout: string; stderr: string }>;
  openExternalUrl: (url: string) => Promise<void>;
  installTool: (tool: "azure-cli" | "kubectl" | "kubelogin" | "all") => Promise<{ message: string }>;
  telepresenceConnect: (clusterContext: string) => Promise<{ success: boolean; stdout: string; stderr: string }>;
  telepresenceStatus: () => Promise<{ success: boolean; stdout: string; stderr: string }>;
  telepresenceQuit: () => Promise<{ success: boolean; stdout: string; stderr: string }>;
}

const api: IpcApi = {
  getClusters: () => ipcRenderer.invoke("get-clusters"),
  getPods: (namespace: string, cluster: string) =>
    ipcRenderer.invoke("get-pods", namespace, cluster),
  getNamespaces: (cluster: string) =>
    ipcRenderer.invoke("get-namespaces", cluster),
  getPodLogs: (namespace: string, podName: string, cluster: string) =>
    ipcRenderer.invoke("get-pod-logs", namespace, podName, cluster),
  deletePod: (namespace: string, podName: string, cluster: string) =>
    ipcRenderer.invoke("delete-pod", namespace, podName, cluster),
  getPodContainers: (namespace: string, podName: string, cluster: string) =>
    ipcRenderer.invoke("get-pod-containers", namespace, podName, cluster),
  getConfigMaps: (namespace: string, cluster: string) =>
    ipcRenderer.invoke("get-configmaps", namespace, cluster),
  updateConfigMap: (namespace: string, name: string, data: Record<string, string>, cluster: string) =>
    ipcRenderer.invoke("update-configmap", namespace, name, data, cluster),
  execPodCommand: (namespace: string, podName: string, containerName: string, cluster: string, command: string) =>
    ipcRenderer.invoke("exec-pod-command", namespace, podName, containerName, cluster, command),
  openExternalUrl: (url: string) => ipcRenderer.invoke("open-external-url", url),
  installTool: (tool: "azure-cli" | "kubectl" | "kubelogin" | "all") =>
    ipcRenderer.invoke("install-tool", tool),
  telepresenceConnect: (clusterContext: string) =>
    ipcRenderer.invoke("telepresence-connect", clusterContext),
  telepresenceStatus: () => ipcRenderer.invoke("telepresence-status"),
  telepresenceQuit: () => ipcRenderer.invoke("telepresence-quit"),
};

contextBridge.exposeInMainWorld("api", api);
