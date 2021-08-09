module.exports = {
  require: ['ts-node/register/transpile-only', 'tsconfig-paths/register'],
  recursive: true,
  reporter: 'dot',
  timeout: 10000
};
