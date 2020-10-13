import { ValidatorFn, Validators } from '@angular/forms';

export const REGEX_URL =
  // eslint-disable-next-line max-len
  '^((http|https)://)?(?:\\S+(?::\\S*)?@)?(?:(?:(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}(?:\\.(?:[0-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))|(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*(?:\\.(?:[a-z\\u00a1-\\uffff]{2,})))|localhost)(?::\\d{2,5})?(?:(/|\\?|#)[^\\s]*)?$';
export const REGEX_AUTH_TOKEN =
  '^[A-Za-z0-9+/=]{7}.nex[ap].[A-Za-z0-9+/=]{32}$';
export const REGEX_UUID =
  '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

export class CustomValidators {
  public static readonly url: ValidatorFn = Validators.pattern(REGEX_URL);
  public static readonly uuid: ValidatorFn = Validators.pattern(REGEX_UUID);
  public static readonly authToken: ValidatorFn = Validators.pattern(
    REGEX_AUTH_TOKEN
  );
}
