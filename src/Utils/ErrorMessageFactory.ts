import { isAxiosError } from 'axios';

type GenericCommandErrorParams =
  | { command: string; error: any }
  | { message: string; error: unknown };

export class ErrorMessageFactory {
  public static genericCommandError(params: GenericCommandErrorParam): string {
    const message = this.getMessageTitle(params);
    const details = this.getMessageDetails(params);

    return this.formatFinalMessage(message, details);
  }
  
  private static formatFinalMessage(baseMessage: string, errorDetails?: string): string {
    return errorDetails 
      ? `${baseMessage}: ${errorDetails}.`
      : `${baseMessage}.`;
  }
  }

  private static getMessageTitle(params: GenericCommandErrorParam): string {
    return 'message' in params
      ? params.message
      : `Error during "${params.command}"`;
  }

  private static extractErrorDetails(
    params: GenericCommandErrorParam
  ): string | null {
    if (typeof params.error === 'string') {
      return params.error;
    }
    if (
      isAxiosError(params.error) &&
      typeof params.error.response?.data === 'string'
    ) {
      params.error.response.data;
    }

    return (params.error.error || params.error.message) ?? null;
  }
}
