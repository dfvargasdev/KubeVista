export function addUniqueValue(values: string[], candidate: string): string[] {
  const normalized = candidate.trim();
  if (!normalized || values.includes(normalized)) {
    return values;
  }

  return [...values, normalized];
}

export function matchesAnyFilter(value: string, filters: string[]): boolean {
  if (filters.length === 0) {
    return true;
  }

  const normalizedValue = value.toLocaleLowerCase();
  return filters.some((filter) => normalizedValue.includes(filter.toLocaleLowerCase()));
}

export function deriveServiceNameFromPod(podName: string): string {
  const deploymentMatch = podName.match(
    /^deployment-(.*)-[a-z0-9]{8,10}-[a-z0-9]{5}$/i
  );
  if (deploymentMatch?.[1]) {
    return `service-${deploymentMatch[1]}`;
  }

  if (podName.startsWith("deployment-")) {
    const parts = podName.split("-");
    const workloadName = parts.length > 3
      ? parts.slice(1, -2).join("-")
      : podName.replace(/^deployment-/, "");
    return `service-${workloadName}`;
  }

  return podName;
}
