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
    let errDetail = {};
    if (error instanceof Error) {
      errDetail = {
        errorMessage: error.message,
        errorStack: error.stack,
      };
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
