import { isAxiosError } from 'axios';

type GenericCommandErrorParam =
  | { command: string; error: any }
  | { message: string; error: unknown };

export class ErrorMessageFactory {
  public static genericCommandError(params: GenericCommandErrorParam): string {
    const message = this.getMessageTitle(params);
    const details = this.getMessageDetails(params);

    return details ? `${message}: ${details}.` : `${message}.`;
  }

  private static getMessageTitle(params: GenericCommandErrorParam): string {
    return 'message' in params
      ? params.message
      : `Error during "${params.command}"`;
  }

  private static getMessageDetails(
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
