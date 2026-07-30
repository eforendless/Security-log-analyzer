export class AlertNotFoundError extends Error {
  public constructor(alertId: string) {
    super(`Alert '${alertId}' was not found.`);
    this.name = 'AlertNotFoundError';
  }
}

export class AlertValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'AlertValidationError';
  }
}
