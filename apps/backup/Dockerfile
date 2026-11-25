# syntax=docker/dockerfile:1
# Built from the repository root: docker build -f apps/backup/Dockerfile .
# pg_dump must be at least the server's major version, so the tag tracks the
# production PostgreSQL major.
FROM postgres:18-alpine@sha256:0115267ab5a509022df9319c77be365cef335adb71556c75f60f5360ee247e71
RUN apk add --no-cache age aws-cli bash
WORKDIR /opt/backup
COPY apps/backup/backup.sh apps/backup/common.sh apps/backup/manifest.sql ./
USER postgres
ENTRYPOINT ["/opt/backup/backup.sh"]
CMD []
