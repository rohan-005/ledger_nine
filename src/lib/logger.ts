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
    
    if (error) {
      let current: any = error;
      let depth = 0;
      const maxDepth = 5;
      
      while (current && depth < maxDepth) {
        const prefix = depth === 0 ? "error" : `cause${depth}`;
        errDetail[`${prefix}Name`] = current.name || current.constructor?.name || "Error";
        errDetail[`${prefix}Message`] = current.message || String(current);
        
        if (typeof current === "object") {
          if (current.code) errDetail[`${prefix}DbCode`] = String(current.code);
          if (current.severity) errDetail[`${prefix}DbSeverity`] = String(current.severity);
          if (current.table) errDetail[`${prefix}DbTable`] = String(current.table);
          else if (current.table_name) errDetail[`${prefix}DbTable`] = String(current.table_name);
          if (current.column) errDetail[`${prefix}DbColumn`] = String(current.column);
          else if (current.column_name) errDetail[`${prefix}DbColumn`] = String(current.column_name);
          if (current.constraint) errDetail[`${prefix}DbConstraint`] = String(current.constraint);
          else if (current.constraint_name) errDetail[`${prefix}DbConstraint`] = String(current.constraint_name);
          if (current.routine) errDetail[`${prefix}DbRoutine`] = String(current.routine);
          if (current.detail) errDetail[`${prefix}DbDetail`] = String(current.detail);
        }
        
        if (current.cause && current.cause !== current) {
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
