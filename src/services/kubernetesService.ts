import * as k8s from "@kubernetes/client-node";
import { Writable } from "stream";

export interface Cluster {
  name: string;
  context: string;
  server: string;
}

export interface Pod {
  name: string;
  namespace: string;
  status: string;
  image?: string;
  restarts?: number;
  age?: string;
  cpu?: string;
  memory?: string;
  containers?: number;
}

export interface Namespace {
  name: string;
  status: string;
  age?: string;
}

export class KubernetesService {
  private kc: k8s.KubeConfig;
  private clients: Map<string, any> = new Map();
  private insecureClusters: Set<string> = new Set();

  constructor() {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();
  }

  getClusters(): Cluster[] {
    const clusters: Cluster[] = [];

    if (this.kc.clusters) {
      this.kc.clusters.forEach((cluster) => {
        clusters.push({
          name: cluster.name || "Unknown",
          context: cluster.name || "Unknown",
          server: cluster.server || "Unknown",
        });
      });
    }

    return clusters;
  }

  async getNamespaces(clusterName: string): Promise<Namespace[]> {
    try {
      return await this.runWithTlsFallback(clusterName, async () => {
        const api = this.getV1Api(clusterName);
        const response = await api.listNamespace();

        return response.body.items.map((ns: any) => ({
          name: ns.metadata?.name || "Unknown",
          status: ns.status?.phase || "Unknown",
        }));
      });
    } catch (error) {
      console.error("Error fetching namespaces:", error);
      throw new Error(this.getKubernetesErrorMessage(error, "namespaces"));
    }
  }

  async getPods(namespace: string, clusterName: string): Promise<Pod[]> {
    try {
      return await this.runWithTlsFallback(clusterName, async () => {
      const api = this.getV1Api(clusterName);
      const response = await api.listNamespacedPod(namespace);

      // Intentar obtener métricas (puede fallar si Metrics Server no está instalado)
      let metrics: Map<string, any> = new Map();
      try {
        const customApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
        const metricsResponse = await (customApi as any).listNamespacedCustomObject(
          "metrics.k8s.io",
          "v1beta1",
          namespace,
          "pods"
        ) as any;
        metricsResponse?.items?.forEach((m: any) => {
          metrics.set(m.metadata?.name, m.containers);
        });
      } catch (err) {
        // Métricas no disponibles, continuamos sin ellas
        console.warn("Metrics not available:", err);
      }

      return response.body.items.map((pod: any) => {
        // Calcular restarts totales de todos los contenedores
        const totalRestarts = pod.status?.containerStatuses?.reduce(
          (sum: number, c: any) => sum + (c.restartCount || 0),
          0
        ) || 0;

        // Calcular edad del pod
        const createdAt = new Date(pod.metadata?.creationTimestamp || Date.now());
        const now = new Date();
        const ageSeconds = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
        const age = this.formatAge(ageSeconds);

        // Obtener métricas si están disponibles
        const podMetrics = metrics.get(pod.metadata?.name);
        let cpu = undefined;
        let memory = undefined;
        if (podMetrics && Array.isArray(podMetrics) && podMetrics.length > 0) {
          cpu = podMetrics[0]?.usage?.cpu;
          memory = podMetrics[0]?.usage?.memory;
        }

        return {
          name: pod.metadata?.name || "Unknown",
          namespace: pod.metadata?.namespace || "Unknown",
          status: pod.status?.phase || "Unknown",
          image: pod.spec?.containers[0]?.image || "Unknown",
          restarts: totalRestarts,
          age,
          cpu: cpu ? cpu.toString() : undefined,
          memory: memory ? memory.toString() : undefined,
          containers: pod.spec?.containers?.length || 0,
        };
      });
      });
    } catch (error) {
      console.error("Error fetching pods:", error);
      throw new Error(this.getKubernetesErrorMessage(error, `pods en namespace "${namespace}"`));
    }
  }

  private formatAge(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  }

  async getPodLogs(
    namespace: string,
    podName: string,
    clusterName: string,
    lines: number = 100
  ): Promise<string> {
    try {
      return await this.runWithTlsFallback(clusterName, async () => {
      const api = this.getV1Api(clusterName);
      const pod = await api.readNamespacedPod(podName, namespace);
      const containerNames = (pod.body.spec?.containers || [])
        .map((c: any) => c.name)
        .filter((name: string | undefined): name is string => Boolean(name));

      if (containerNames.length === 0) {
        throw new Error(`El pod ${podName} no tiene contenedores definidos.`);
      }

      // Prefer app container over service mesh sidecars when possible.
      const preferredContainers = [
        ...containerNames.filter((name) => name !== "istio-proxy"),
        ...containerNames.filter((name) => name === "istio-proxy"),
      ];

      const log = new k8s.Log(this.kc);
      const errors: string[] = [];

      for (const containerName of preferredContainers) {
        const chunks: Buffer[] = [];
        const logStream = new Writable({
          write(chunk: Buffer, _encoding: string, callback: () => void) {
            chunks.push(chunk);
            callback();
          },
        });

        try {
          await new Promise<void>((resolve, reject) => {
            log.log(namespace, podName, containerName, logStream, { tailLines: lines })
              .then(() => logStream.on("finish", resolve))
              .catch(reject);
          });

          const output = Buffer.concat(chunks).toString();
          return output.length > 0
            ? output
            : `No hay logs disponibles para ${podName} (contenedor: ${containerName}).`;
        } catch (containerError) {
          const msg = (containerError as any)?.body?.message
            || (containerError as Error)?.message
            || "Error desconocido";
          errors.push(`${containerName}: ${msg}`);
        }
      }

      throw new Error(
        `No se pudo leer logs de ${podName}. Detalles: ${errors.join(" | ")}`
      );
      });
    } catch (error) {
      console.error("Error fetching pod logs:", error);
      if (error instanceof Error && error.message) {
        throw error;
      }
      throw new Error(this.getKubernetesErrorMessage(error, `logs del pod "${podName}"`));
    }
  }

  private async runWithTlsFallback<T>(clusterName: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!this.isTlsCertificateError(error) || this.insecureClusters.has(clusterName)) {
        throw error;
      }

      console.warn(`TLS validation failed for ${clusterName}. Retrying with skipTLSVerify enabled.`);
      this.enableInsecureTlsForCluster(clusterName);
      return await operation();
    }
  }

  private enableInsecureTlsForCluster(clusterName: string): void {
    const cluster = this.kc.getClusters().find((c) => c.name === clusterName);
    if (!cluster) {
      return;
    }

    (cluster as any).skipTLSVerify = true;
    this.insecureClusters.add(clusterName);
    this.clients.delete(clusterName);
  }

  private isTlsCertificateError(error: unknown): boolean {
    const err = error as any;
    const message = `${err?.message || ""} ${err?.body?.message || ""}`.toLowerCase();
    return err?.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
      || message.includes("unable to verify")
      || message.includes("certificate")
      || message.includes("x509");
  }

  async deletePod(namespace: string, podName: string, clusterName: string): Promise<void> {
    try {
      const api = this.getV1Api(clusterName);
      await api.deleteNamespacedPod(podName, namespace);
    } catch (error) {
      console.error("Error deleting pod:", error);
      throw error;
    }
  }

  private getKubernetesErrorMessage(error: unknown, resource: string): string {
    const err = error as any;
    const statusCode = err?.statusCode ?? err?.response?.statusCode;
    const apiMessage = err?.body?.message ?? err?.response?.body?.message;
    const errorMessage = err?.message;

    if (statusCode === 403) {
      return `Sin permisos para listar ${resource} en este cluster (RBAC 403).`;
    }

    if (err?.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
      return "No se pudo validar el certificado TLS del cluster.";
    }

    if (typeof apiMessage === "string" && apiMessage.length > 0) {
      return apiMessage;
    }

    if (typeof errorMessage === "string" && errorMessage.length > 0) {
      return errorMessage;
    }

    return `Error consultando ${resource} en el cluster seleccionado.`;
  }

  private getV1Api(clusterName: string): k8s.CoreV1Api {
    if (!this.clients.has(clusterName)) {
      const ctx = this.kc.getContexts().find((context) => context.name === clusterName);
      if (ctx) {
        this.kc.setCurrentContext(clusterName);
      }
      this.clients.set(clusterName, this.kc.makeApiClient(k8s.CoreV1Api));
    }

    return this.clients.get(clusterName);
  }
}
