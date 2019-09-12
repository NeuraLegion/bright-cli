const mockRequestsType = {
  $id: 'requests',
  type: 'array',
  items: { $ref: 'request' },
  minItems: 1
};

const requestType = {
  $id: 'request',
  type: 'object',
  description: 'Mock request',
  required: ['method', 'type'],
  properties: {
    method: {
      type: 'string',
      enum: [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'PATCH',
        'HEAD',
        'TRACE',
        'OPTIONS',
        'CONNECT'
      ]
    },
    url: { type: 'string', format: 'uri-reference', optional: true },
    type: {
      type: 'string',
      enum: [
        'buffer',
        'json',
        'multipart',
        'file',
        'stream',
        'form_urlencoded',
        'text'
      ]
    },
    headers: { $ref: 'record' },
    body: {
      oneOf: [{ $ref: 'record' }, { $ref: 'multiPart' }, { type: 'string' }]
    }
  }
};

const recordType = {
  $id: 'record',
  optional: true,
  type: 'object',
  description: 'Helper name-value pair structure.',
  patternProperties: {
    '.{1,}': { type: 'string' }
  }
};

const multiPartPostData = {
  $id: 'multiPart',
  optional: true,
  type: 'object',
  description: 'Posted form-urlencoded data info.',
  patternProperties: {
    '.{1,}': {
      oneOf: [
        { $ref: 'multiPartItem' },
        { type: 'array', items: { $ref: 'multiPartItem' } }
      ]
    }
  }
};

const multiPartItemType = {
  $id: 'multiPartItem',
  description: 'Helper name-value pair structure.',
  type: 'object',
  required: ['type'],
  properties: {
    type: {
      type: 'string',
      enum: ['buffer', 'file', 'stream', 'text']
    },
    body: { type: 'string' },
    mimeType: { type: 'string' },
    fileName: { type: 'string' }
  }
};

export default [
  mockRequestsType,
  requestType,
  recordType,
  multiPartPostData,
  multiPartItemType
];
