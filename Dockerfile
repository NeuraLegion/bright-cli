FROM node:18-alpine as base

ARG VERSION

LABEL org.opencontainers.image.vendor="Bright Security Inc."
LABEL org.opencontainers.image.title="Repeater"
LABEL org.opencontainers.image.source="git@github.com:NeuraLegion/bright-cli.git"
LABEL org.opencontainers.image.url="https://github.com/NeuraLegion/bright-cli"
LABEL org.opencontainers.image.authors="Artem Derevnjuk <artem.derevnjuk@brightsec.com>"
LABEL org.opencontainers.image.version="$VERSION"

# a few environment variables to make NPM installs easier
# good colors for most applications
ENV TERM xterm

# inform cli that it's running inside docker container
ENV BRIGHT_CLI_DOCKER 1

# avoid million NPM install messages
ENV npm_config_loglevel warn
# allow installing when the main user is root
ENV npm_config_unsafe_perm true

#  add libraries needed to build os-service
RUN apk add --no-cache --virtual .build-deps make gcc g++ python3 \
    && npm i -g -q @brightsec/cli@${VERSION} \
    && apk del .build-deps

USER node
ENTRYPOINT [ "bright-cli" ]
CMD ["repeater"]
