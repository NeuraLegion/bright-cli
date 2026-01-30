FROM node:24-alpine as base

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
ENV NPM_CONFIG_LOGLEVEL warn
# allow installing when the main user is root
ENV NPM_CONFIG_UNSAFE_PERM true
# set CLI basepath
ENV HOME /home/node
# set as default NPM prefix a custom folder
ENV NPM_CONFIG_PREFIX $HOME/.npm
# disable npm update check
ENV NPM_CONFIG_UPDATE_NOTIFIER false
# add local bin dir to path
ENV PATH $PATH:$NPM_CONFIG_PREFIX/bin
# increase max HTTP header size for node runtime
ENV NODE_OPTIONS --max-http-header-size=32768

# make folder for npm package
RUN set -eux; \
    mkdir $NPM_CONFIG_PREFIX/; \
    chown -R 1000:1000 $NPM_CONFIG_PREFIX/

# install @brightsec/cli from NPM
RUN set -eux; \
    npm i -g -q @brightsec/cli@${VERSION}

# set the directory and file permissions to allow users in the root group to access files
# for details please refer to the doc at https://docs.openshift.com/container-platform/3.11/creating_images/guidelines.html#openshift-specific-guidelines
RUN set -eux; \
    chgrp -R 0 /home/node; \
    chmod -R g+rwX /home/node; \
    chown -R 1000 /home/node

# change workgin dir
WORKDIR $HOME/

# set as default a non-privileged user named node.
USER 1000
ENTRYPOINT [ "bright-cli" ]
CMD ["--help"]
