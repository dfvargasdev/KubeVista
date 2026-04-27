import { ipcRenderer, contextBridge } from "electron";

interface IpcApi {
  getClusters: () => Promise<any>;
  getPods: (namespace: string, cluster: string) => Promise<any>;
  getNamespaces: (cluster: string) => Promise<any>;
  getPodLogs: (namespace: string, podName: string, cluster: string) => Promise<string>;
  deletePod: (namespace: string, podName: string, cluster: string) => Promise<void>;
  getPodContainers: (namespace: string, podName: string, cluster: string) => Promise<string[]>;
  execPodCommand: (
    namespace: string,
    podName: string,
    containerName: string,
    cluster: string,
    command: string
  ) => Promise<{ success: boolean; stdout: string; stderr: string }>;
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
  execPodCommand: (namespace: string, podName: string, containerName: string, cluster: string, command: string) =>
    ipcRenderer.invoke("exec-pod-command", namespace, podName, containerName, cluster, command),
};

contextBridge.exposeInMainWorld("api", api);
