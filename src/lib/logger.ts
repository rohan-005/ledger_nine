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
    let errDetail: Record<string, unknown> = {};
    if (error instanceof Error) {
      errDetail = {
        errorName: error.name || error.constructor?.name,
        errorMessage: error.message,
        errorStack: error.stack,
      };
      
      const cause = (error as any).cause;
      if (cause) {
        errDetail.causeName = cause.name || cause.constructor?.name;
        errDetail.causeMessage = cause.message;
        if (typeof cause === "object") {
          if (cause.code) errDetail.dbCode = String(cause.code);
          if (cause.table_name) errDetail.dbTable = String(cause.table_name);
          else if (cause.table) errDetail.dbTable = String(cause.table);
          if (cause.column_name) errDetail.dbColumn = String(cause.column_name);
          else if (cause.column) errDetail.dbColumn = String(cause.column);
          if (cause.constraint) errDetail.dbConstraint = String(cause.constraint);
        }
      }
    } else if (error) {
      errDetail = { errorRaw: String(error) };
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
