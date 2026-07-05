type LogContext = {
  researchId?: string;
  node?: string;
  agentId?: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  fallbackUsed?: boolean;
  status?: string;
  errorCode?: string;
  [key: string]: unknown;
};

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "INFO",
        message,
        ...context,
      })
    );
  },

  warn(message: string, context?: LogContext) {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "WARN",
        message,
        ...context,
      })
    );
  },

  error(message: string, error?: unknown, context?: LogContext) {
    const errDetail: Record<string, unknown> = {};

    if (error !== undefined && error !== null) {
      let current: any = error;
      let depth = 0;
      const maxDepth = 5;

      while (current && depth < maxDepth) {
        const prefix = depth === 0 ? "error" : `cause${depth}`;

        // Determine error name
        if (current instanceof Error) {
          errDetail[`${prefix}Name`] = current.name || current.constructor?.name || "Error";
        } else if (typeof current === "object") {
          errDetail[`${prefix}Name`] = current.constructor?.name || "Object";
        } else {
          errDetail[`${prefix}Name`] = typeof current;
        }

        // Determine error message — never serialize as [object Object]
        if (typeof current === "object" && current !== null) {
          if (typeof current.message === "string" && current.message) {
            errDetail[`${prefix}Message`] = current.message;
          } else if (typeof current.error === "string") {
            // Some SDK errors use `error` field
            errDetail[`${prefix}Message`] = current.error;
          } else if (typeof current.msg === "string") {
            errDetail[`${prefix}Message`] = current.msg;
          } else {
            // Serialize the object safely, truncated
            try {
              const serialized = JSON.stringify(current);
              errDetail[`${prefix}Message`] = serialized.length > 500
                ? serialized.slice(0, 500) + "…"
                : serialized;
            } catch {
              errDetail[`${prefix}Message`] = "[non-serializable object]";
            }
          }
        } else {
          errDetail[`${prefix}Message`] = String(current);
        }

        // Extract DB/provider diagnostic fields from objects
        if (typeof current === "object" && current !== null) {
          if (current.code) errDetail[`${prefix}Code`] = String(current.code);
          if (current.severity) errDetail[`${prefix}DbSeverity`] = String(current.severity);
          if (current.table) errDetail[`${prefix}DbTable`] = String(current.table);
          else if (current.table_name) errDetail[`${prefix}DbTable`] = String(current.table_name);
          if (current.column) errDetail[`${prefix}DbColumn`] = String(current.column);
          else if (current.column_name) errDetail[`${prefix}DbColumn`] = String(current.column_name);
          if (current.constraint) errDetail[`${prefix}DbConstraint`] = String(current.constraint);
          else if (current.constraint_name) errDetail[`${prefix}DbConstraint`] = String(current.constraint_name);
          if (current.routine) errDetail[`${prefix}DbRoutine`] = String(current.routine);
          if (current.detail) errDetail[`${prefix}DbDetail`] = String(current.detail);
          // Provider-specific: retryable flag
          if (typeof current.retryable === "boolean") errDetail[`${prefix}Retryable`] = current.retryable;
        }

        if (current?.cause && current.cause !== current) {
          current = current.cause;
          depth++;
        } else {
          break;
        }
      }

      if (error instanceof Error) {
        errDetail.errorStack = error.stack;
      }
    }

    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "ERROR",
        message,
        ...errDetail,
        ...context,
      })
    );
  },
};
