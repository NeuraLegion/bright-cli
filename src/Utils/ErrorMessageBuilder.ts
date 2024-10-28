import { isAxiosError } from 'axios';

export class ErrorMessageBuilder {
  public static buildMessage(
    params:
      | { error: unknown; message: string }
      | { error: any; command: string }
  ): string {
    const message =
      'message' in params ? params.message : `Error during "${params.command}"`;

    const errMessage =
      typeof params.error === 'string'
        ? params.error
        : isAxiosError(params.error) &&
          typeof params.error.response?.data === 'string'
        ? params.error.response.data
        : params.error.error || params.error.message;

    return errMessage ? `${message}: ${errMessage}.` : `${message}.`;
  }
}
