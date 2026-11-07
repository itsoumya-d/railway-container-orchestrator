// The deployment doctor — the fix for opaque "Deployment failed" errors.
//
// Every failed deployment carries structured logs. The doctor reads them and
// returns a classified cause, the evidence lines that prove it, and the exact
// repair to apply. New failure classes are one row in this table.

import { Deployment } from "./store.js";

export type FailureClass =
  | "MISSING_START_CMD"
  | "PORT_NOT_LISTENING"
  | "OOMKilled"
  | "MISSING_ENV"
  | "HEALTH_CHECK_FAILED"
  | "BUILD_FAIL"
  | "UNKNOWN";

export interface Diagnosis {
  deploymentId: string;
  status: string;
  failureClass: FailureClass;
  summary: string;
  evidence: string[];
  fix: string;
}

const FIXES: Record<FailureClass, string> = {
  MISSING_START_CMD:
    "Set a non-empty start command on the service (e.g. `node dist/server.js`) and redeploy.",
  PORT_NOT_LISTENING:
    "Bind the process to the service port (0.0.0.0:$PORT) so the healthcheck can reach it.",
  OOMKilled:
    "Raise the service memory limit or reduce the working set; the container was killed for exceeding its limit.",
  MISSING_ENV:
    "Fill in the empty environment variables listed in the evidence, then redeploy.",
  HEALTH_CHECK_FAILED:
    "The container is listening but the healthcheck returns 5xx. Check the app router and unset HEALTHCHECK_FAILS once fixed.",
  BUILD_FAIL:
    "The build step failed. Fix the error lines above, then redeploy; the builder caches only successful layers.",
  UNKNOWN:
    "No known pattern matched. Read the full logs in the deployment output and share them with the platform team.",
};

function classify(logs: string[], errorCode: string | null): FailureClass {
  const text = logs.join("\n");
  if (errorCode === "MISSING_START_CMD" || /no start command/.test(text)) return "MISSING_START_CMD";
  if (errorCode === "PORT_NOT_LISTENING" || /does not bind a TCP port/.test(text)) return "PORT_NOT_LISTENING";
  if (errorCode === "OOMKilled" || /oom-kill/.test(text)) return "OOMKilled";
  if (errorCode === "MISSING_ENV" || /empty env:/.test(text)) return "MISSING_ENV";
  if (errorCode === "HEALTH_CHECK_FAILED" || /healthcheck failed/.test(text)) return "HEALTH_CHECK_FAILED";
  if (/ERROR|error:/.test(text) && !/no start command/.test(text)) return "BUILD_FAIL";
  return "UNKNOWN";
}

function evidence(logs: string[]): string[] {
  return logs.filter((l) => /ERROR|kernel:|healthcheck failed|does not bind|no start|empty env/.test(l)).slice(0, 6);
}

export function diagnose(deployment: Deployment): Diagnosis {
  const failureClass = classify(deployment.logs, deployment.errorCode);
  const ev = evidence(deployment.logs);
  return {
    deploymentId: deployment.id,
    status: deployment.status,
    failureClass,
    summary:
      deployment.status === "RUNNING"
        ? "Deployment is running; no failure to diagnose."
        : `Deployment ${deployment.status.toLowerCase()} with cause class ${failureClass}.`,
    evidence: ev.length > 0 ? ev : deployment.logs.slice(-4),
    fix:
      deployment.status === "RUNNING"
        ? "Nothing to fix. Run `down` when you are done."
        : FIXES[failureClass],
  };
}
