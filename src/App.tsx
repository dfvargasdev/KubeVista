import React, { useEffect, useMemo, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import {
  FiBox,
  FiExternalLink,
  FiGrid,
  FiHome,
  FiPlayCircle,
  FiTerminal,
} from "react-icons/fi";

const HomeIcon = FiHome as React.ElementType;
const ExternalLinkIcon = FiExternalLink as React.ElementType;
const TerminalIcon = FiTerminal as React.ElementType;

type AppView = "home" | "clusters" | "telepresence" | "prerequisites";
type InstallTool = "azure-cli" | "kubectl" | "kubelogin" | "all";
const LAST_CLUSTER_KEY = "last-selected-cluster";

interface TelepresenceStatusSection {
  title: string;
  fields: Array<{ label: string; value: string }>;
}

type ActionTone = "info" | "success" | "error";

const quickLinks = {
  azureCli: "https://learn.microsoft.com/cli/azure/install-azure-cli-windows",
  kubectl: "https://kubernetes.io/docs/tasks/tools/install-kubectl-windows/",
  kubelogin: "https://azure.github.io/kubelogin/install.html",
  telepresenceDocs: "https://telepresence.io/docs/quick-start",
  telepresenceInstall: "https://telepresence.io/docs/install/client/",
  telepresenceWindowsDownload:
    "https://github.com/telepresenceio/telepresence/releases/latest/download/telepresence-windows-amd64-setup.exe",
};

function App() {
  const [view, setView] = useState<AppView>("home");
  const [actionMessage, setActionMessage] = useState<string>("");
  const [actionTone, setActionTone] = useState<ActionTone>("info");
  const [telepresenceLoading, setTelepresenceLoading] = useState(false);
  const [telepresenceClusters, setTelepresenceClusters] = useState<string[]>([]);
  const [telepresenceClusterContext, setTelepresenceClusterContext] = useState<string>("");
  const [telepresenceStatusSections, setTelepresenceStatusSections] =
    useState<TelepresenceStatusSection[] | null>(null);
  const [telepresenceConnectSection, setTelepresenceConnectSection] =
    useState<TelepresenceStatusSection | null>(null);

  const homeCards = useMemo(
    () => [
      {
        key: "clusters" as const,
        title: "Clusters",
        description: "Administra pods, logs, namespaces y configmaps.",
        icon: FiGrid,
      },
      {
        key: "telepresence" as const,
        title: "Telepresence",
        description: "Accesos rapidos a documentacion y pasos recomendados.",
        icon: FiPlayCircle,
      },
      {
        key: "prerequisites" as const,
        title: "Requisitos previos",
        description: "Instalacion de Azure CLI, kubectl y kubelogin.",
        icon: FiBox,
      },
    ],
    []
  );

  const openExternalUrl = async (url: string) => {
    try {
      await window.api.openExternalUrl(url);
      setActionTone("info");
    } catch (error) {
      setActionTone("error");
      setActionMessage(`No se pudo abrir el enlace: ${String(error)}`);
    }
  };

  const runInstall = async (tool: InstallTool) => {
    setActionTone("info");
    setActionMessage("Iniciando instalacion...");
    try {
      const result = await window.api.installTool(tool);
      setActionTone("success");
      setActionMessage(result.message);
    } catch (error) {
      setActionTone("error");
      setActionMessage(`Error al iniciar instalacion: ${String(error)}`);
    }
  };

  const parseTelepresenceConnect = (rawOutput: string): TelepresenceStatusSection => {
    const oneLine = rawOutput.replace(/\r/g, " ").replace(/\n/g, " ").trim();
    const contextMatch = oneLine.match(/context\s+([^,]+)/i);
    const namespaceMatch = oneLine.match(/namespace\s+([^\s(]+)/i);
    const serverMatch = oneLine.match(/\((https?:\/\/[^)]+)\)/i);

    return {
      title: "Conexion Telepresence",
      fields: [
        { label: "Resultado", value: "Conectado" },
        { label: "Contexto", value: contextMatch?.[1]?.trim() || telepresenceClusterContext || "-" },
        { label: "Namespace", value: namespaceMatch?.[1]?.trim() || "-" },
        { label: "Servidor", value: serverMatch?.[1]?.trim() || "-" },
      ],
    };
  };

  const parseTelepresenceStatus = (rawOutput: string): TelepresenceStatusSection[] => {
    const lines = rawOutput.replace(/\r/g, "").split("\n");
    const sections: TelepresenceStatusSection[] = [];
    let currentSection: TelepresenceStatusSection | null = null;

    const splitOnce = (input: string): [string, string] => {
      const idx = input.indexOf(":");
      if (idx < 0) {
        return [input.trim(), ""];
      }
      return [input.slice(0, idx).trim(), input.slice(idx + 1).trim()];
    };

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      if (!line.startsWith(" ")) {
        const [title, value] = splitOnce(line);
        currentSection = {
          title,
          fields: value ? [{ label: "Estado", value }] : [],
        };
        sections.push(currentSection);
        continue;
      }

      if (!currentSection) {
        continue;
      }

      const trimmed = line.trim();
      if (trimmed.startsWith("- ")) {
        currentSection.fields.push({ label: "Detalle", value: trimmed.slice(2).trim() });
        continue;
      }

      const [label, value] = splitOnce(trimmed);
      if (!label) {
        continue;
      }

      if (!value) {
        currentSection.fields.push({ label, value: "-" });
      } else {
        currentSection.fields.push({ label, value });
      }
    }

    return sections;
  };

  useEffect(() => {
    if (view !== "telepresence") {
      return;
    }

    const loadClusterContexts = async () => {
      try {
        const clusters = await window.api.getClusters();
        const contexts = (clusters || [])
          .map((cluster: { context?: string; name?: string }) => cluster.context || cluster.name)
          .filter((value: string | undefined): value is string => Boolean(value));

        setTelepresenceClusters(contexts);
        if (!telepresenceClusterContext) {
          const lastCluster = localStorage.getItem(LAST_CLUSTER_KEY) || "";
          const preferred = contexts.find((ctx: string) => ctx === lastCluster) || contexts[0] || "";
          setTelepresenceClusterContext(preferred);
        }
      } catch (error) {
        setActionTone("error");
        setActionMessage(`No se pudieron cargar los clusters para Telepresence: ${String(error)}`);
      }
    };

    loadClusterContexts();
  }, [view, telepresenceClusterContext]);

  const handleTelepresenceConnect = async () => {
    if (!telepresenceClusterContext) {
      setActionTone("error");
      setActionMessage("Selecciona un cluster/contexto antes de conectar.");
      return;
    }

    setTelepresenceLoading(true);
    setTelepresenceStatusSections(null);
    setTelepresenceConnectSection(null);
    setActionTone("info");
    setActionMessage("Conectando Telepresence...");
    try {
      const result = await window.api.telepresenceConnect(telepresenceClusterContext);
      const details = [result.stdout, result.stderr].filter(Boolean).join("\n");
      if (result.success) {
        setTelepresenceConnectSection(parseTelepresenceConnect(details));
        setActionTone("success");
        setActionMessage("Conexion establecida correctamente.");
      } else {
        setActionTone("error");
        setActionMessage(`Error al conectar.\n${details}`);
      }
    } catch (error) {
      setActionTone("error");
      setActionMessage(`Error al conectar Telepresence: ${String(error)}`);
    } finally {
      setTelepresenceLoading(false);
    }
  };

  const handleTelepresenceStatus = async () => {
    setTelepresenceLoading(true);
    setTelepresenceConnectSection(null);
    setActionTone("info");
    setActionMessage("Consultando estado de Telepresence...");
    try {
      const result = await window.api.telepresenceStatus();
      const details = [result.stdout, result.stderr].filter(Boolean).join("\n");
      if (result.success) {
        const parsed = parseTelepresenceStatus(details);
        setTelepresenceStatusSections(parsed.length ? parsed : null);
        setActionTone("success");
        setActionMessage("Estado de Telepresence actualizado.");
      } else {
        setTelepresenceStatusSections(null);
        setActionTone("error");
        setActionMessage(`No se pudo consultar status.\n${details}`);
      }
    } catch (error) {
      setTelepresenceStatusSections(null);
      setActionTone("error");
      setActionMessage(`Error consultando status: ${String(error)}`);
    } finally {
      setTelepresenceLoading(false);
    }
  };

  const handleTelepresenceQuit = async () => {
    setTelepresenceLoading(true);
    setTelepresenceStatusSections(null);
    setTelepresenceConnectSection(null);
    setActionTone("info");
    setActionMessage("Desconectando Telepresence...");
    try {
      const result = await window.api.telepresenceQuit();
      const details = [result.stdout, result.stderr].filter(Boolean).join("\n");
      if (result.success) {
        setActionTone("success");
        setActionMessage(`Telepresence desconectado.\n${details}`);
      } else {
        setActionTone("error");
        setActionMessage(`No se pudo desconectar.\n${details}`);
      }
    } catch (error) {
      setActionTone("error");
      setActionMessage(`Error al desconectar: ${String(error)}`);
    } finally {
      setTelepresenceLoading(false);
    }
  };

  if (view === "clusters") {
    return (
      <div className="app">
        <Dashboard onGoHome={() => setView("home")} />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-auto bg-gray-100 text-gray-900">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              KV
            </div>
            <div>
              <h1 className="text-2xl font-bold">KubeVista</h1>
              <p className="text-xs text-gray-500">Version 2 · Centro de inicio</p>
            </div>
          </div>
          {view !== "home" && (
            <button
              onClick={() => setView("home")}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 text-sm hover:bg-gray-50"
            >
              <HomeIcon className="w-4 h-4" />
              Menu inicial
            </button>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        {view === "home" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Selecciona una opcion</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {homeCards.map((card) => {
                const CardIcon = card.icon as React.ElementType;
                return (
                  <button
                    key={card.key}
                    onClick={() => setView(card.key)}
                    className="bg-white border border-gray-200 rounded-xl p-5 text-left shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
                      <CardIcon className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">{card.title}</h3>
                    <p className="text-sm text-gray-600">{card.description}</p>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {view === "telepresence" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Telepresence</h2>
            <p className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg p-4">
              Aqui tendras acceso rapido para configurar Telepresence y comenzar a trabajar
              con desarrollo remoto en Kubernetes.
            </p>
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <label className="text-sm font-medium text-gray-700">Cluster / Contexto</label>
              <select
                value={telepresenceClusterContext}
                onChange={(event) => setTelepresenceClusterContext(event.target.value)}
                className="w-full md:w-96 px-3 py-2 border border-gray-300 rounded-md bg-white"
              >
                {!telepresenceClusters.length && <option value="">No hay clusters disponibles</option>}
                {telepresenceClusters.map((context) => (
                  <option key={context} value={context}>
                    {context}
                  </option>
                ))}
              </select>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleTelepresenceConnect}
                  disabled={telepresenceLoading || !telepresenceClusterContext}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Conectar
                </button>
                <button
                  onClick={handleTelepresenceStatus}
                  disabled={telepresenceLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Status
                </button>
                <button
                  onClick={handleTelepresenceQuit}
                  disabled={telepresenceLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Desconectar
                </button>
              </div>
            </div>

            {telepresenceStatusSections && telepresenceStatusSections.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {telepresenceStatusSections.map((section) => (
                  <div key={section.title} className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">{section.title}</h3>
                    <div className="space-y-2">
                      {section.fields.map((field, index) => (
                        <div
                          key={`${section.title}-${field.label}-${index}`}
                          className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2"
                        >
                          <span className="text-xs font-medium text-gray-500 min-w-[120px]">
                            {field.label}
                          </span>
                          <span className="text-sm text-gray-800 text-right break-all">
                            {field.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {telepresenceConnectSection && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-green-900 mb-3">
                  {telepresenceConnectSection.title}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {telepresenceConnectSection.fields.map((field, index) => (
                    <div
                      key={`${field.label}-${index}`}
                      className="flex items-start justify-between gap-3 bg-white rounded-md px-3 py-2 border border-green-100"
                    >
                      <span className="text-xs font-medium text-green-700">{field.label}</span>
                      <span className="text-sm text-green-900 text-right break-all">{field.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => openExternalUrl(quickLinks.telepresenceDocs)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                <ExternalLinkIcon className="w-4 h-4" />
                Ver documentacion
              </button>
              <button
                onClick={() => openExternalUrl(quickLinks.telepresenceInstall)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 bg-white hover:bg-gray-50"
              >
                <ExternalLinkIcon className="w-4 h-4" />
                Guia de instalacion
              </button>
              <button
                onClick={() => openExternalUrl(quickLinks.telepresenceWindowsDownload)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-green-300 bg-green-50 text-green-800 hover:bg-green-100"
              >
                <ExternalLinkIcon className="w-4 h-4" />
                Descargar installer Windows
              </button>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Nota: algunas versiones del instalador pueden abrir la URL legacy
              telepresence.io/docs. Si eso pasa, usa los botones "Ver documentacion"
              o "Guia de instalacion" de arriba.
            </p>
          </section>
        )}

        {view === "prerequisites" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Requisitos previos</h2>
            <ol className="space-y-3">
              <li className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-medium">1. Instalar Azure CLI</p>
                    <p className="text-xs text-gray-500">Necesario para autenticacion y utilidades AKS.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openExternalUrl(quickLinks.azureCli)}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                    >
                      <ExternalLinkIcon className="w-4 h-4" />
                      Enlace
                    </button>
                    <button
                      onClick={() => runInstall("azure-cli")}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <TerminalIcon className="w-4 h-4" />
                      Instalar
                    </button>
                  </div>
                </div>
              </li>

              <li className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-medium">2. Instalar kubectl</p>
                    <p className="text-xs text-gray-500">CLI base para administracion de Kubernetes.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openExternalUrl(quickLinks.kubectl)}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                    >
                      <ExternalLinkIcon className="w-4 h-4" />
                      Enlace
                    </button>
                    <button
                      onClick={() => runInstall("kubectl")}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <TerminalIcon className="w-4 h-4" />
                      Instalar
                    </button>
                  </div>
                </div>
              </li>

              <li className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-medium">3. Instalar kubelogin</p>
                    <p className="text-xs text-gray-500">Requerido para autenticacion con AKS via Azure AD.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openExternalUrl(quickLinks.kubelogin)}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-50"
                    >
                      <ExternalLinkIcon className="w-4 h-4" />
                      Enlace
                    </button>
                    <button
                      onClick={() => runInstall("kubelogin")}
                      className="inline-flex items-center gap-1 px-3 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                      <TerminalIcon className="w-4 h-4" />
                      Instalar
                    </button>
                  </div>
                </div>
              </li>
            </ol>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-blue-900">
                Instalacion rapida en Windows: ejecuta Azure CLI, kubectl y kubelogin en secuencia.
              </p>
              <button
                onClick={() => runInstall("all")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-700 text-white hover:bg-blue-800"
              >
                <TerminalIcon className="w-4 h-4" />
                Instalar todo con un clic
              </button>
            </div>
          </section>
        )}

        {actionMessage && (
          <div
            className={`text-sm rounded-lg p-3 whitespace-pre-wrap ${
              actionTone === "success"
                ? "bg-green-50 border border-green-200 text-green-900"
                : actionTone === "error"
                ? "bg-red-50 border border-red-200 text-red-900"
                : "bg-white border border-gray-200 text-gray-800"
            }`}
          >
            {actionMessage}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 px-6 py-3 text-xs text-gray-500">
        <p>KubeVista • Kubernetes Cluster Manager • Diego Vargas (dfVargasDev)</p>
      </footer>
    </div>
  );
}

export default App;
