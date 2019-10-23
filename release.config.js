module.exports = {
  plugins: [
    '@semantic-release/commit-analyzer',
    [
      '@semantic-release/release-notes-generator',
      {
        writerOpts: {
          commitsSort: ['subject', 'scope']
        }
      }
    ],
    [
      '@semantic-release/github',
      {
        assets: ['dist/**']
      }
    ]
  ],
  branch: 'master',
  ci: true
};
