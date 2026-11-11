# syntax=docker/dockerfile:1
# Built from the repository root: docker build -f apps/backup/Dockerfile .
# pg_dump must be at least the server's major version, so the tag tracks the
# production PostgreSQL major.
FROM postgres:18-alpine@sha256:123b17998ccaf47e53b502e8c6a1e79afd8f579c6f3eec83c563da026f957395
RUN apk add --no-cache age aws-cli bash
WORKDIR /opt/backup
COPY apps/backup/backup.sh apps/backup/common.sh apps/backup/manifest.sql ./
USER postgres
ENTRYPOINT ["/opt/backup/backup.sh"]
CMD []
