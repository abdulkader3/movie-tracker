import { ApiError } from '../services/api/http';

export function friendlyApiError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'offline':
        return 'You appear to be offline. Saved entries stay available, but searching needs an internet connection.';
      case 'config':
        return error.message;
      case 'parse':
        return 'The service returned an unexpected response.';
      case 'timeout':
        return `The movie service took too long to respond (request ${error.message}). Please try again.`;
      default:
        return `Request failed (${error.message}).`;
    }
  }
  console.error(error);
  return 'Something went wrong. Please try again.';
}
