FROM node:10-alpine as base

LABEL org.opencontainers.image.vendor="NeuraLegion"
LABEL org.opencontainers.image.title="Repeater"
LABEL org.opencontainers.image.source="https://github.com/NeuraLegion/nexploit-cli"
LABEL org.opencontainers.image.authors="Arten Derevnjuk <artem.derevnjuk@neuralegion.com>"

# a few environment variables to make NPM installs easier
# good colors for most applications
ENV TERM xterm

# avoid million NPM install messages
ENV npm_config_loglevel warn
# allow installing when the main user is root
ENV npm_config_unsafe_perm true

RUN echo "whoami: $(whoami)"
RUN npm config -g set user $(whoami)

RUN npm i -g -q @neuralegion/nexploit-cli

ENTRYPOINT [ "nexploit-cli" ]
CMD ["repeater"]
