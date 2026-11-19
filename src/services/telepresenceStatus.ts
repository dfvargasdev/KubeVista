export interface TelepresenceCommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

export function isTelepresenceConnected(result: TelepresenceCommandResult): boolean {
  if (!result.success) {
    return false;
  }

  const output = `${result.stdout}\n${result.stderr}`.toLocaleLowerCase();
  const disconnectedSignals = [
    "not connected",
    "disconnected",
    "not running",
    "no active session",
  ];

  if (disconnectedSignals.some((signal) => output.includes(signal))) {
    return false;
  }

  return output.includes("connected to context")
    || output.includes("traffic manager: connected")
    || /user daemon:[\s\S]*\bconnected\b/.test(output);
}

export function getTelepresenceContext(
  result: TelepresenceCommandResult
): string | null {
  if (!result.success) {
    return null;
  }

  const output = `${result.stdout}\n${result.stderr}`;
  const patterns = [
    /connected to context\s+["']?([^,\s"'()]+)/i,
    /^\s*kubernetes context:\s*(.+)$/im,
    /^\s*context:\s*(.+)$/im,
  ];

  for (const pattern of patterns) {
    const match = output.match(pattern);
    const context = match?.[1]?.trim().replace(/[,"']+$/, "");
    if (context) {
      return context;
    }
  }

  return null;
}
