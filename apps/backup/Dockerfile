# syntax=docker/dockerfile:1
# Built from the repository root: docker build -f apps/backup/Dockerfile .
# pg_dump must be at least the server's major version, so the tag tracks the
# production PostgreSQL major.
FROM postgres:18-alpine@sha256:1018733457011bf88d81db98cf43aac6d5150afc18787dbe204771fedf80ff95
RUN apk add --no-cache age aws-cli bash
WORKDIR /opt/backup
COPY apps/backup/backup.sh apps/backup/common.sh apps/backup/manifest.sql ./
USER postgres
ENTRYPOINT ["/opt/backup/backup.sh"]
CMD []
