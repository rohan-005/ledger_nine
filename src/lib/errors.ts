export class AppError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly metadata?: Record<string, unknown>;

  constructor(message: string, code = "INTERNAL_ERROR", retryable = false, metadata?: Record<string, unknown>, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.retryable = retryable;
    this.metadata = metadata;
    if (cause) {
      this.cause = cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", false, metadata);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, "CONFIGURATION_ERROR", false, metadata);
  }
}

export class IntegrationError extends AppError {
  constructor(message: string, provider: string, messageDetail: string, retryable = false, metadata?: Record<string, unknown>, cause?: unknown) {
    super(
      `Integration error with ${provider}: ${messageDetail}`,
      `INTEGRATION_ERROR_${provider.toUpperCase()}`,
      retryable,
      { ...metadata, provider },
      cause
    );
  }
}

export class RateLimitError extends AppError {
  constructor(provider: string, message = "Rate limit exceeded", metadata?: Record<string, unknown>) {
    super(message, `RATE_LIMIT_ERROR_${provider.toUpperCase()}`, true, { ...metadata, provider });
  }
}

export class ProviderUnavailableError extends AppError {
  constructor(provider: string, message = "Provider is currently unavailable", metadata?: Record<string, unknown>, cause?: unknown) {
    super(message, `PROVIDER_UNAVAILABLE_${provider.toUpperCase()}`, true, { ...metadata, provider }, cause);
  }
}

export class LLMOutputValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, "LLM_OUTPUT_VALIDATION_ERROR", false, metadata);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, retryable = false, cause?: unknown) {
    super(message, "DATABASE_ERROR", retryable, undefined, cause);
  }
}

export class ResearchNotFoundError extends AppError {
  constructor(researchId: string) {
    super(`Research run not found: ${researchId}`, "RESEARCH_NOT_FOUND", false, { researchId });
  }
}

export class SkippedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkippedError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.metadata,
      },
    };
  }

  const err = error as Error;
  return {
    success: false,
    error: {
      code: "UNKNOWN_ERROR",
      message: err.message || "An unexpected error occurred",
    },
  };
}
