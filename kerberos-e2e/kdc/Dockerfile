FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    krb5-kdc \
    krb5-admin-server \
    krb5-user \
    netcat-openbsd \
 && rm -rf /var/lib/apt/lists/*

COPY krb5.conf      /etc/krb5.conf
COPY kdc.conf       /etc/krb5kdc/kdc.conf
COPY kadm5.acl      /etc/krb5kdc/kadm5.acl
COPY entrypoint.sh  /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 88 749

ENTRYPOINT ["/entrypoint.sh"]
