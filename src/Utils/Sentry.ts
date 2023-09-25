import { init } from '@sentry/node';

export function sentry() {
  init({
    attachStacktrace: true,
    dsn: process.env.SENTRY_DSN,
    release: process.env.VERSION,
    beforeSend: (event) => {
      if (event.contexts.args) {
        event.contexts.args = {
          ...event.contexts.args,
          t: event.contexts.args.t && '[Filtered]',
          token: event.contexts.args.token && '[Filtered]'
        };
      }

      return event;
    }
  });
}
