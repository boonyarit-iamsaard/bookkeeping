# syntax=docker/dockerfile:1
# Built from the repository root: docker build -f apps/backup/Dockerfile .
# pg_dump must be at least the server's major version, so the tag tracks the
# production PostgreSQL major.
FROM postgres:18-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873
RUN apk add --no-cache age aws-cli bash
WORKDIR /opt/backup
COPY apps/backup/backup.sh apps/backup/manifest.sql ./
USER postgres
ENTRYPOINT ["/opt/backup/backup.sh"]
CMD []
