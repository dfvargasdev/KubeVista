import React, { useEffect, useState } from "react";
import { FiCopy, FiLock, FiRefreshCw, FiTrash2, FiUnlock } from "react-icons/fi";
import { decryptPayload, encryptPayload } from "./payloadCrypto";

const CopyIcon = FiCopy as React.ElementType;
const LockIcon = FiLock as React.ElementType;
const RefreshIcon = FiRefreshCw as React.ElementType;
const TrashIcon = FiTrash2 as React.ElementType;
const UnlockIcon = FiUnlock as React.ElementType;

const PUBLIC_KEY_STORAGE_KEY = "payload-encryptor.public-key";
const PRIVATE_KEY_STORAGE_KEY = "payload-encryptor.private-key";

type StatusTone = "info" | "success" | "error";

interface StatusState {
  message: string;
  tone: StatusTone;
}

const textAreaClass =
  "w-full min-h-[132px] resize-y rounded-md border border-gray-300 bg-white px-3 py-2 " +
  "font-mono text-xs text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none " +
  "focus:ring-2 focus:ring-blue-100";

const compactTextAreaClass = `${textAreaClass} min-h-[96px]`;

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function prettyJson(value: string): string {
  return JSON.stringify(JSON.parse(value), null, 2);
}

function getStoredValue(key: string): string {
  try {
    return window.localStorage.getItem(key) || "";
  } catch (error) {
    return "";
  }
}

function setStoredValue(key: string, value: string): void {
  try {
    if (value.trim()) {
      window.localStorage.setItem(key, value);
      return;
    }
    window.localStorage.removeItem(key);
  } catch (error) {
    return;
  }
}

export function PayloadEncryptor() {
  const [publicKey, setPublicKey] = useState(() => getStoredValue(PUBLIC_KEY_STORAGE_KEY));
  const [privateKey, setPrivateKey] = useState(() => getStoredValue(PRIVATE_KEY_STORAGE_KEY));
  const [plainPayload, setPlainPayload] = useState("");
  const [minifyJson, setMinifyJson] = useState(true);
  const [encryptXKey, setEncryptXKey] = useState("");
  const [encryptedBody, setEncryptedBody] = useState("");
  const [decryptXKey, setDecryptXKey] = useState("");
  const [decryptBody, setDecryptBody] = useState("");
  const [plainOutput, setPlainOutput] = useState("");
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [status, setStatus] = useState<StatusState>({ message: "Ready", tone: "info" });

  useEffect(() => {
    setStoredValue(PUBLIC_KEY_STORAGE_KEY, publicKey);
  }, [publicKey]);

  useEffect(() => {
    setStoredValue(PRIVATE_KEY_STORAGE_KEY, privateKey);
  }, [privateKey]);

  const copyValue = async (value: string) => {
    if (!value) {
      setStatus({ message: "Nothing to copy", tone: "error" });
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setStatus({ message: "Copied", tone: "success" });
    } catch (error) {
      setStatus({ message: `Copy failed: ${formatError(error)}`, tone: "error" });
    }
  };

  const handleEncrypt = async () => {
    setIsEncrypting(true);
    setStatus({ message: "Encrypting payload...", tone: "info" });
    try {
      const result = await encryptPayload({ payload: plainPayload, publicKeyText: publicKey, minifyJson });
      setEncryptXKey(result.xKey);
      setEncryptedBody(result.bodyText);
      setDecryptXKey(result.xKey);
      setDecryptBody(result.bodyText);
      setStatus({ message: "Payload encrypted", tone: "success" });
    } catch (error) {
      setStatus({ message: formatError(error), tone: "error" });
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleDecrypt = async () => {
    setIsDecrypting(true);
    setStatus({ message: "Decrypting payload...", tone: "info" });
    try {
      const result = await decryptPayload({
        xKeyText: decryptXKey,
        bodyText: decryptBody,
        privateKeyText: privateKey,
      });
      setPlainOutput(result);
      setStatus({ message: "Payload decrypted", tone: "success" });
    } catch (error) {
      setStatus({ message: formatError(error), tone: "error" });
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleFormatPlainPayload = () => {
    try {
      setPlainPayload(prettyJson(plainPayload));
      setStatus({ message: "JSON formatted", tone: "success" });
    } catch (error) {
      setStatus({ message: formatError(error), tone: "error" });
    }
  };

  const handleFormatPlainOutput = () => {
    try {
      setPlainOutput(prettyJson(plainOutput));
      setStatus({ message: "JSON formatted", tone: "success" });
    } catch (error) {
      setStatus({ message: formatError(error), tone: "error" });
    }
  };

  const clearValues = () => {
    setPlainPayload("");
    setEncryptXKey("");
    setEncryptedBody("");
    setDecryptXKey("");
    setDecryptBody("");
    setPlainOutput("");
    setStatus({ message: "Ready", tone: "info" });
  };

  const forgetKeys = () => {
    setPublicKey("");
    setPrivateKey("");
    window.localStorage.removeItem(PUBLIC_KEY_STORAGE_KEY);
    window.localStorage.removeItem(PRIVATE_KEY_STORAGE_KEY);
    setStatus({ message: "Keys removed from this device", tone: "success" });
  };

  const statusClass =
    status.tone === "success"
      ? "border-green-200 bg-green-50 text-green-900"
      : status.tone === "error"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-gray-200 bg-white text-gray-800";

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Payload Encryptor</h2>
          <p className="text-sm text-gray-600">Contrato fijo: header x-key y body field data.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={forgetKeys}
            className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100"
          >
            <TrashIcon className="h-4 w-4" />
            Olvidar llaves
          </button>
          <button
            onClick={clearValues}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
          >
            <TrashIcon className="h-4 w-4" />
            Limpiar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900">Encriptar payload</h3>
            <label className="inline-flex items-center gap-2 text-xs text-gray-600">
              <input
                checked={minifyJson}
                onChange={(event) => setMinifyJson(event.target.checked)}
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Minificar JSON
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-600">Llave publica RSA</span>
            <textarea
              value={publicKey}
              onChange={(event) => setPublicKey(event.target.value)}
              spellCheck={false}
              className={compactTextAreaClass}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-600">Payload plano</span>
            <textarea
              value={plainPayload}
              onChange={(event) => setPlainPayload(event.target.value)}
              spellCheck={false}
              className={textAreaClass}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleEncrypt}
              disabled={isEncrypting}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <LockIcon className="h-4 w-4" />
              Encriptar
            </button>
            <button
              onClick={handleFormatPlainPayload}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              <RefreshIcon className="h-4 w-4" />
              Formatear JSON
            </button>
          </div>

          <OutputField label="x-key" value={encryptXKey} onCopy={() => copyValue(encryptXKey)} />
          <OutputField label='Body {"data"}' value={encryptedBody} onCopy={() => copyValue(encryptedBody)} />
        </div>

        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">Desencriptar payload</h3>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-600">Llave privada RSA</span>
            <textarea
              value={privateKey}
              onChange={(event) => setPrivateKey(event.target.value)}
              spellCheck={false}
              className={compactTextAreaClass}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-600">x-key</span>
            <textarea
              value={decryptXKey}
              onChange={(event) => setDecryptXKey(event.target.value)}
              spellCheck={false}
              className={compactTextAreaClass}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-600">Body con data</span>
            <textarea
              value={decryptBody}
              onChange={(event) => setDecryptBody(event.target.value)}
              spellCheck={false}
              className={textAreaClass}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDecrypt}
              disabled={isDecrypting}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <UnlockIcon className="h-4 w-4" />
              Desencriptar
            </button>
            <button
              onClick={handleFormatPlainOutput}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              <RefreshIcon className="h-4 w-4" />
              Formatear salida
            </button>
          </div>

          <OutputField label="Payload plano" value={plainOutput} onCopy={() => copyValue(plainOutput)} />
        </div>
      </div>

      <div className={`rounded-lg border p-3 text-sm ${statusClass}`}>{status.message}</div>
    </section>
  );
}

interface OutputFieldProps {
  label: string;
  value: string;
  onCopy: () => void;
}

function OutputField({ label, value, onCopy }: OutputFieldProps) {
  return (
    <label className="block space-y-1">
      <span className="flex items-center justify-between gap-2 text-xs font-medium text-gray-600">
        {label}
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          <CopyIcon className="h-3.5 w-3.5" />
          Copiar
        </button>
      </span>
      <textarea value={value} readOnly spellCheck={false} className={compactTextAreaClass} />
    </label>
  );
}
