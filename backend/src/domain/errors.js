export class CriteriaError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'CriteriaError';
    this.statusCode = 400;
    this.details = details;
  }
}
