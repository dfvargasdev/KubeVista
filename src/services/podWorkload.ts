interface PodOwnerReference {
  apiVersion?: string;
  controller?: boolean;
  kind?: string;
  name?: string;
}

interface PodMetadata {
  name?: string;
  labels?: Record<string, string>;
  ownerReferences?: PodOwnerReference[];
}

export interface PodWithWorkloadMetadata {
  metadata?: PodMetadata;
}

export interface PodWorkloadIdentity {
  key: string;
  displayName: string;
}

function getReplicaSetDeploymentName(ownerName: string, labels: Record<string, string>): string {
  const podTemplateHash = labels["pod-template-hash"];
  if (podTemplateHash && ownerName.endsWith(`-${podTemplateHash}`)) {
    return ownerName.slice(0, -(podTemplateHash.length + 1));
  }

  return ownerName.replace(/-[a-z0-9]{8,10}$/i, "");
}

function getLabelIdentity(labels: Record<string, string>): PodWorkloadIdentity | null {
  const instance = labels["app.kubernetes.io/instance"];
  const name = labels["app.kubernetes.io/name"];
  if (instance || name) {
    return {
      key: `Labels/${instance || ""}/${name || ""}`,
      displayName: instance || name,
    };
  }

  const app = labels.app || labels["k8s-app"];
  return app ? { key: `Labels/${app}`, displayName: app } : null;
}

function getPodNameFallback(podName: string): string {
  const deploymentMatch = podName.match(/^(.*)-[a-z0-9]{8,10}-[a-z0-9]{5}$/i);
  if (deploymentMatch?.[1]) {
    return deploymentMatch[1];
  }

  const statefulSetMatch = podName.match(/^(.*)-\d+$/);
  return statefulSetMatch?.[1] || podName;
}

export function getPodWorkloadIdentity(pod: PodWithWorkloadMetadata): PodWorkloadIdentity {
  const podName = pod.metadata?.name || "unknown-pod";
  const labels = pod.metadata?.labels || {};
  const owners = pod.metadata?.ownerReferences || [];
  const owner = owners.find((reference) => reference.controller) || owners[0];

  if (owner?.kind && owner.name) {
    if (owner.kind === "ReplicaSet") {
      const deploymentName = getReplicaSetDeploymentName(owner.name, labels);
      return {
        key: `Deployment/${deploymentName}`,
        displayName: deploymentName,
      };
    }

    return {
      key: `${owner.kind}/${owner.name}`,
      displayName: owner.name,
    };
  }

  return getLabelIdentity(labels) || {
    key: `PodGroup/${getPodNameFallback(podName)}`,
    displayName: getPodNameFallback(podName),
  };
}
