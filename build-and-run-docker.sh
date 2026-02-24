#!/bin/sh

docker buildx build --build-arg VERSION=13.10.2-next.2 -t aborovskiibright/brightsec-cli-child-ns:latest -f Dockerfile .
docker run --entrypoint bright-cli --network=bridge --rm aborovskiibright/brightsec-cli-child-ns:latest --log-level 4 --hostname host.docker.internal repeater --id xxdm2uaPkysWStHbTSKTLN --token g0as0ad.nexr.gso94kt5mlntisy3c0rrmm0frjmdzic0