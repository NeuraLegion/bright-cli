FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    apache2 \
    libapache2-mod-auth-gssapi \
    krb5-user \
    curl \
 && a2enmod auth_gssapi headers \
 && rm -rf /var/lib/apt/lists/*

COPY krb5.conf   /etc/krb5.conf
COPY spnego.conf /etc/apache2/sites-enabled/000-default.conf

# Unauthenticated health-check page used by Docker healthcheck
RUN mkdir -p /var/www/html && echo "OK" > /var/www/html/health

# Protected content served after successful Kerberos authentication
RUN echo "Hello, authenticated user!" > /var/www/html/protected/index.html 2>/dev/null || \
    (mkdir -p /var/www/html/protected && echo "Hello, authenticated user!" > /var/www/html/protected/index.html)

EXPOSE 80

# Wait for the keytab to be written by the KDC container, then start Apache.
# The KDC writes to the shared volume; we poll until the file appears.
CMD ["bash", "-c", \
  "echo '[httpd] Waiting for keytab from KDC...'; \
   until [ -f /keytabs/HTTP.keytab ]; do sleep 2; done; \
   echo '[httpd] Keytab found — installing'; \
   cp /keytabs/HTTP.keytab /etc/krb5.keytab && \
   chmod 640 /etc/krb5.keytab && \
   chown root:www-data /etc/krb5.keytab && \
   echo '[httpd] Starting Apache'; \
   apachectl -D FOREGROUND"]
