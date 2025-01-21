import { isAxiosError } from 'axios';

type GenericCommandErrorParams =
  | { command: string; error: any }
  | { message: string; error: unknown };

export class ErrorMessageFactory {
  public static genericCommandError(params: GenericCommandErrorParams): string {
    const message = this.getTitle(params);
    const details = this.extractErrorDetails(params);

    return this.formatFinalMessage(message, details);
  }

  private static formatFinalMessage(
    baseMessage: string,
    errorDetails?: string
  ): string {
    return errorDetails
      ? `${baseMessage}: ${errorDetails}.`
      : `${baseMessage}.`;
  }

  private static getTitle(params: GenericCommandErrorParams): string {
    return 'message' in params
      ? params.message
      : `Error during "${params.command}"`;
  }

  private static extractErrorDetails(
    params: GenericCommandErrorParams
  ): string | null {
    if (typeof params.error === 'string') {
      return params.error;
    }

    if (isAxiosError(params.error)) {
      switch (typeof params.error.response?.data) {
        case 'string':
          return params.error.response.data;
      }
    }

    return (params.error.error || params.error.message) ?? null;
  }
}
