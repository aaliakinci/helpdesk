FROM node:24.19.0-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03 AS base

RUN apt-get update \
    && apt-get install --yes --no-install-recommends openssl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
RUN chown node:node /workspace

FROM base AS development

COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node src/server/apps/support-api/package.json src/server/apps/support-api/package.json
COPY --chown=node:node src/server/apps/support-worker/package.json src/server/apps/support-worker/package.json
COPY --chown=node:node src/web/package.json src/web/package.json
USER node
RUN npm ci --ignore-scripts

COPY --chown=node:node . .
RUN npm run prisma:generate

FROM development AS build
RUN npm run build

FROM base AS server-runtime

COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci --omit=dev --omit=peer --legacy-peer-deps --ignore-scripts --workspaces=false
COPY --from=build --chown=node:node /workspace/dist ./dist

# Runtime processes execute compiled Node.js only. Package managers are build-time tooling and
# retaining their dependency trees would unnecessarily enlarge the production attack surface.
USER root
RUN rm -rf /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /opt/yarn-v1.22.22 \
    && rm -f /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg
RUN install --directory --owner=node --group=node --mode=0700 /var/lib/helpdesk/attachments
USER node

FROM server-runtime AS support-api
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/server/apps/support-api/src/main.js"]

FROM server-runtime AS support-worker
EXPOSE 8081
CMD ["node", "--enable-source-maps", "dist/server/apps/support-worker/src/main.js"]

FROM build AS support-web
EXPOSE 4173
CMD ["npm", "run", "preview", "--workspace", "@helpdesk/support-web", "--", "--host", "0.0.0.0"]
