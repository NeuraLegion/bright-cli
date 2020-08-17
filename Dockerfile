FROM node:10-alpine as base

LABEL org.opencontainers.image.vendor="NeuraLegion"
LABEL org.opencontainers.image.title="Agent"
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

ARG API_KEY
ENV API_KEY=${API_KEY}

ARG AGENT_ID
ENV AGENT_ID=${AGENT_ID}

ARG HEADERS="{}"
ENV HEADERS=${HEADERS}

ARG BUS="amqps://amq.nexploit.app:5672"
ENV BUS=${BUS}

ENTRYPOINT [ "nexploit-cli", "agent", "--api-key", "$API_KEY", "--bus", "$BUS", "--headers", "$HEADERS", "$AGENT_ID" ]
CMD ["nexploit-cli"]
