// Date time fields use ISO8601 (YYYY-MM-DDThh:mm:ss.sTZD, e.g. 2009-07-24T19:20:30.45+01:00)
const dateTimePattern =
  '^(d{4})(-)?(dd)(-)?(dd)(T)?(dd)(:)?(dd)(:)?(dd)(.d+)?(Z|([+-])(dd)(:)?(dd))';

const harType = {
  $id: 'har',
  type: 'object',
  required: ['log'],
  properties: {
    log: {
      $ref: 'log'
    }
  }
};

const logType = {
  $id: 'log',
  description: 'HTTP Archive structure.',
  type: 'object',
  required: ['version', 'creator', 'entries'],
  properties: {
    log: {
      type: 'object',
      properties: {
        version: { type: 'string' },
        creator: { $ref: 'creator' },
        browser: { $ref: 'browser' },
        pages: { type: 'array', optional: true, items: { $ref: 'page' } },
        entries: { type: 'array', items: { $ref: 'entry' } },
        comment: { type: 'string', optional: true }
      }
    }
  }
};

const creatorType = {
  $id: 'creator',
  description: 'Name and version info of the log creator app.',
  type: 'object',
  required: ['name', 'version'],
  properties: {
    name: { type: 'string' },
    version: { type: 'string' },
    comment: { type: 'string', optional: true }
  }
};

const browserType = {
  $id: 'browser',
  description: 'Name and version info of used browser.',
  type: 'object',
  optional: true,
  required: ['name', 'version'],
  properties: {
    name: { type: 'string' },
    version: { type: 'string' },
    comment: { type: 'string', optional: true }
  }
};

const pageType = {
  $id: 'page',
  description: 'Exported web page',
  optional: true,
  required: ['startedDateTime', '$id', 'title', 'pageTimings'],
  properties: {
    startedDateTime: {
      type: 'string',
      format: 'date-time',
      pattern: dateTimePattern
    },
    $id: { type: 'string', unique: true },
    title: { type: 'string' },
    pageTimings: { $ref: 'pageTimings' },
    comment: { type: 'string', optional: true }
  }
};

const pageTimingsType = {
  $id: 'pageTimings',
  description: 'Timing info about page load',
  properties: {
    onContentLoad: { type: 'number', optional: true, min: -1 },
    onLoad: { type: 'number', optional: true, min: -1 },
    comment: { type: 'string', optional: true }
  }
};

const entryType = {
  $id: 'entry',
  description: 'Request and Response related info',
  optional: true,
  required: [
    'startedDateTime',
    'time',
    'request',
    'response',
    'cache',
    'timings'
  ],
  properties: {
    pageref: { type: 'string', optional: true },
    startedDateTime: {
      type: 'string',
      format: 'date-time',
      pattern: dateTimePattern
    },
    time: { type: 'number', min: 0 },
    request: { $ref: 'request' },
    response: { $ref: 'response' },
    cache: { $ref: 'cache' },
    timings: { $ref: 'timings' },
    serverIPAddress: {
      type: 'string',
      optional: true
    },
    connection: { type: 'string', optional: true },
    comment: { type: 'string', optional: true }
  }
};

const requestType = {
  $id: 'request',
  description: 'Monitored request',
  required: [
    'method',
    'url',
    'httpVersion',
    'cookies',
    'headers',
    'queryString',
    'headersSize',
    'bodySize'
  ],
  properties: {
    method: { type: 'string' },
    url: { type: 'string' },
    httpVersion: { type: 'string' },
    cookies: { type: 'array', items: { $ref: 'cookie' } },
    headers: { type: 'array', items: { $ref: 'record' } },
    queryString: { type: 'array', items: { $ref: 'record' } },
    postData: { $ref: 'postData' },
    headersSize: { type: 'integer', min: -1 },
    bodySize: { type: 'integer', min: -1 },
    comment: { type: 'string', optional: true }
  }
};

const recordType = {
  $id: 'record',
  required: ['name', 'value'],
  description: 'Helper name-value pair structure.',
  properties: {
    name: { type: 'string' },
    value: { type: 'string' },
    comment: { type: 'string', optional: true }
  }
};

const responseType = {
  $id: 'response',
  description: 'Monitored Response.',
  required: [
    'status',
    'statusText',
    'httpVersion',
    'cookies',
    'headers',
    'content',
    'redirectURL',
    'headersSize',
    'bodySize'
  ],
  properties: {
    status: { type: 'integer' },
    statusText: { type: 'string' },
    httpVersion: { type: 'string' },
    cookies: { type: 'array', items: { $ref: 'cookie' } },
    headers: { type: 'array', items: { $ref: 'record' } },
    content: { $ref: 'content' },
    redirectURL: { type: 'string' },
    headersSize: { type: 'integer', min: -1 },
    bodySize: { type: 'integer', min: -1 },
    comment: { type: 'string', optional: true }
  }
};

const cookieType = {
  $id: 'cookie',
  description: 'Cookie description.',
  required: ['name', 'value'],
  properties: {
    name: { type: 'string' },
    value: { type: 'string' },
    path: { type: 'string', optional: true },
    domain: { type: 'string', optional: true },
    expires: { type: 'string', optional: true },
    httpOnly: { type: 'boolean', optional: true },
    secure: { type: 'boolean', optional: true },
    comment: { type: 'string', optional: true }
  }
};

const postDataType = {
  $id: 'postData',
  description: 'Posted data info.',
  optional: true,
  required: ['mimeType'],
  properties: {
    mimeType: { type: 'string' },
    text: { type: 'string', optional: true },
    params: {
      type: 'array',
      optional: true,
      properties: {
        name: { type: 'string' },
        value: { type: 'string', optional: true },
        fileName: { type: 'string', optional: true },
        content: { type: 'string', optional: true },
        comment: { type: 'string', optional: true }
      }
    },
    comment: { type: 'string', optional: true }
  }
};

const contentType = {
  $id: 'content',
  description: 'Response content',
  required: ['size', 'mimeType'],
  properties: {
    size: { type: 'integer' },
    compression: { type: 'integer', optional: true },
    mimeType: { type: 'string' },
    text: { type: 'string', optional: true },
    encoding: { type: 'string', optional: true },
    comment: { type: 'string', optional: true }
  }
};

const cacheType = {
  $id: 'cache',
  description: 'Info about a response coming from the cache.',
  properties: {
    beforeRequest: { $ref: 'cacheEntry' },
    afterRequest: { $ref: 'cacheEntry' },
    comment: { type: 'string', optional: true }
  }
};

const cacheEntryType = {
  $id: 'cacheEntry',
  optional: true,
  description: 'Info about cache entry.',
  required: ['lastAccess', 'eTag', 'hitCount'],
  properties: {
    expires: {
      type: 'string',
      optional: 'true',
      pattern:
        '^(\\d{4})(-)?(\\d\\d)(-)?(\\d\\d)(T)?(\\d\\d)(:)?(\\d\\d)(:)?(\\d\\d)(\\.\\d+)?(Z|([+-])(\\d\\d)(:)?(\\d\\d))?'
    },
    lastAccess: {
      type: 'string',
      pattern:
        '^(\\d{4})(-)?(\\d\\d)(-)?(\\d\\d)(T)?(\\d\\d)(:)?(\\d\\d)(:)?(\\d\\d)(\\.\\d+)?(Z|([+-])(\\d\\d)(:)?(\\d\\d))?'
    },
    eTag: { type: 'string' },
    hitCount: { type: 'integer' },
    comment: { type: 'string', optional: true }
  }
};

const timingsType = {
  $id: 'timings',
  required: ['send', 'wait', 'receive'],
  description: 'Info about request-response timing.',
  properties: {
    dns: { type: 'number', optional: true, min: -1 },
    connect: { type: 'number', optional: true, min: -1 },
    blocked: { type: 'number', optional: true, min: -1 },
    send: { type: 'number' },
    wait: { type: 'number' },
    receive: { type: 'number' },
    ssl: { type: 'number', optional: true, min: -1 },
    comment: { type: 'string', optional: true }
  }
};

export default [
  harType,
  logType,
  creatorType,
  browserType,
  pageType,
  pageTimingsType,
  entryType,
  requestType,
  cookieType,
  recordType,
  responseType,
  postDataType,
  contentType,
  cacheType,
  cacheEntryType,
  timingsType
];
