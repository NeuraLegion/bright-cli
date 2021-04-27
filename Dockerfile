FROM node:14-alpine as base

ARG VERSION

LABEL org.opencontainers.image.vendor="NeuraLegion"
LABEL org.opencontainers.image.title="Repeater"
LABEL org.opencontainers.image.source="git@github.com:NeuraLegion/nexploit-cli.git"
LABEL org.opencontainers.image.url="https://github.com/NeuraLegion/nexploit-cli"
LABEL org.opencontainers.image.authors="Arten Derevnjuk <artem.derevnjuk@neuralegion.com>"
LABEL org.opencontainers.image.version="$VERSION"

# a few environment variables to make NPM installs easier
# good colors for most applications
ENV TERM xterm

# avoid million NPM install messages
ENV npm_config_loglevel warn
# allow installing when the main user is root
ENV npm_config_unsafe_perm true

RUN echo "whoami: $(whoami)"
RUN npm config -g set user $(whoami)

#  add libraries needed to build os-service
RUN apk add --no-cache --virtual .build-deps make gcc g++ python \
    && npm i -g -q @neuralegion/nexploit-cli@${VERSION} \
    && apk del .build-deps

ENTRYPOINT [ "nexploit-cli" ]
CMD ["repeater"]
