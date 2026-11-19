import { ChildProcess, spawn } from "child_process";
import { randomUUID } from "crypto";

const LOOPBACK_ADDRESS = "127.0.0.1";
const START_TIMEOUT_MS = 30000;
const MAX_DIAGNOSTIC_LENGTH = 8192;

export interface PortForwardRequest {
  cluster: string;
  namespace: string;
  podName: string;
  remotePort: number;
  localPort: number;
}

export interface PortForwardSession extends PortForwardRequest {
  id: string;
  address: string;
  url: string;
  startedAt: string;
}

interface ManagedPortForward {
  process: ChildProcess;
  session: PortForwardSession;
  ready: boolean;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} es obligatorio.`);
  }

  return value.trim();
}

function requirePort(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${label} debe ser un numero entero entre 1 y 65535.`);
  }

  return value;
}

export function normalizePortForwardRequest(request: PortForwardRequest): PortForwardRequest {
  if (!request || typeof request !== "object") {
    throw new Error("Solicitud de port-forward invalida.");
  }

  return {
    cluster: requireNonEmptyString(request.cluster, "El cluster"),
    namespace: requireNonEmptyString(request.namespace, "El namespace"),
    podName: requireNonEmptyString(request.podName, "El pod"),
    remotePort: requirePort(request.remotePort, "El puerto remoto"),
    localPort: requirePort(request.localPort, "El puerto local"),
  };
}

export function buildPortForwardArgs(request: PortForwardRequest): string[] {
  const normalized = normalizePortForwardRequest(request);

  return [
    "--context",
    normalized.cluster,
    "--namespace",
    normalized.namespace,
    "port-forward",
    `pod/${normalized.podName}`,
    `${normalized.localPort}:${normalized.remotePort}`,
    "--address",
    LOOPBACK_ADDRESS,
  ];
}

function appendDiagnostic(current: string, chunk: unknown): string {
  return `${current}${String(chunk)}`.slice(-MAX_DIAGNOSTIC_LENGTH);
}

function startFailureMessage(output: string, exitCode?: number | null): string {
  const details = output.trim();
  if (details) {
    return details;
  }

  return exitCode === null || exitCode === undefined
    ? "kubectl no pudo iniciar el port-forward."
    : `kubectl finalizo con codigo ${exitCode} antes de abrir el puerto.`;
}

export class PortForwardManager {
  private readonly sessions = new Map<string, ManagedPortForward>();

  async start(request: PortForwardRequest): Promise<PortForwardSession> {
    const normalized = normalizePortForwardRequest(request);
    const localPortInUse = Array.from(this.sessions.values()).some(
      ({ session }) => session.localPort === normalized.localPort
    );

    if (localPortInUse) {
      throw new Error(`El puerto local ${normalized.localPort} ya esta siendo usado por KubeVista.`);
    }

    const id = randomUUID();
    const session: PortForwardSession = {
      ...normalized,
      id,
      address: LOOPBACK_ADDRESS,
      url: `http://${LOOPBACK_ADDRESS}:${normalized.localPort}`,
      startedAt: new Date().toISOString(),
    };
    const child = spawn("kubectl", buildPortForwardArgs(normalized), {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const managed: ManagedPortForward = { process: child, session, ready: false };
    this.sessions.set(id, managed);

    return new Promise<PortForwardSession>((resolve, reject) => {
      let diagnostic = "";
      let settled = false;
      const timeout = setTimeout(() => {
        failBeforeReady(
          `El port-forward no quedo listo despues de ${START_TIMEOUT_MS / 1000} segundos. `
          + "Verifica la conectividad y autenticacion del cluster."
        );
      }, START_TIMEOUT_MS);

      const markReady = () => {
        if (settled) return;
        settled = true;
        managed.ready = true;
        clearTimeout(timeout);
        resolve({ ...session });
      };

      const failBeforeReady = (message: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.sessions.delete(id);
        if (child.exitCode === null && !child.killed) {
          child.kill();
        }
        reject(new Error(message));
      };

      const handleOutput = (chunk: unknown) => {
        diagnostic = appendDiagnostic(diagnostic, chunk);
        if (/Forwarding from\s+127\.0\.0\.1:\d+\s+->/i.test(diagnostic)) {
          markReady();
        }
      };

      child.stdout?.on("data", handleOutput);
      child.stderr?.on("data", handleOutput);
      child.once("error", (error) => {
        if (!managed.ready) {
          failBeforeReady(`No se pudo ejecutar kubectl: ${error.message}`);
        } else {
          this.sessions.delete(id);
        }
      });
      child.once("exit", (code) => {
        this.sessions.delete(id);
        if (!managed.ready) {
          failBeforeReady(startFailureMessage(diagnostic, code));
        }
      });
    });
  }

  list(): PortForwardSession[] {
    return Array.from(this.sessions.values())
      .filter(({ ready }) => ready)
      .map(({ session }) => ({ ...session }))
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  }

  stop(id: string): void {
    const normalizedId = requireNonEmptyString(id, "El identificador del port-forward");
    const managed = this.sessions.get(normalizedId);
    if (!managed) {
      return;
    }

    this.sessions.delete(normalizedId);
    if (managed.process.exitCode === null && !managed.process.killed) {
      const signaled = managed.process.kill();
      if (!signaled) {
        throw new Error("No se pudo detener el proceso de port-forward.");
      }
    }
  }

  stopAll(): void {
    for (const { process: child } of this.sessions.values()) {
      if (child.exitCode === null && !child.killed) {
        child.kill();
      }
    }
    this.sessions.clear();
  }
}
