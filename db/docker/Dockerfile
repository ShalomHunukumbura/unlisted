# The same postgres:16-alpine as before, plus pgvector (Neon has it built in).
# Built on the alpine image, not pgvector/pgvector (Debian), so the existing
# data volume keeps working: its text sort order comes from alpine's libc.
FROM postgres:16-alpine

ARG PGVECTOR_VERSION=v0.8.1
RUN apk add --no-cache --virtual .build-deps git build-base \
 && git clone --depth 1 --branch "$PGVECTOR_VERSION" https://github.com/pgvector/pgvector.git /tmp/pgvector \
 && cd /tmp/pgvector \
 && make OPTFLAGS="" with_llvm=no \
 && make install with_llvm=no \
 && rm -rf /tmp/pgvector \
 && apk del .build-deps
