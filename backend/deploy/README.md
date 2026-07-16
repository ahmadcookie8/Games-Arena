# Production backend deployment

The production backend uses one Docker Compose application on EC2. GitHub
Actions builds a commit-addressed backend image, pushes it to Docker Hub,
resolves the registry digest, and deploys that exact immutable digest to the
`node` service. Nginx continues to proxy the public API and Socket.IO traffic to
the service bound on `127.0.0.1:3000`.

This is an **in-place deployment**, not blue/green. Recreating the Node
container causes a brief API and WebSocket interruption. Production workflow
concurrency prevents two automated deployments from overlapping.

## Checks and deployment sequence

Automatic pull-request CI is intentionally lean and can also be run manually:

- Backend checks install locked dependencies under Node 24, test the shared
  game engine, run the backend non-stress test suite, and build the backend.
- Frontend checks install locked dependencies under Node 24 and build the
  frontend.

The longer randomized backend stress test, frontend unit/browser/multiplayer
and visual suites, lint, audits, broad scans, container scans, and SBOM tooling
remain available for local or deliberate manual use. CodeQL is manual-only;
these checks are not automatic gates on every pull request or release.

For a backend release, the deployment workflow:

1. Builds and pushes an image tagged with the Git commit, then resolves and
   validates its immutable Docker Hub `sha256` digest.
2. Opens SSH only after matching the exact EC2 host against the trusted
   `EC2_KNOWN_HOSTS` value, with batch mode and strict host-key checking.
3. Copies only the reviewed `backend/docker-compose.yml` candidate to the
   deployment directory. The remote shell verifies Docker, Compose, `curl`,
   the protected `.env`, and the current and candidate Compose files.
4. Forces `NODE_ENV=production` and the canonical frontend origin, validates
   the candidate Compose model with the exact image digest, then records the
   current Compose file and running Node image as rollback metadata. The image
   reference is retained in `backend-image.previous` with mode `0600`.
5. Atomically installs the candidate, pulls the exact Node digest, and
   recreates the Compose `node` service in place. The existing Redis service
   and its named data volume remain intact.
6. Polls `http://127.0.0.1:3000/api/health`, then verifies the public TLS route
   through the local Nginx listener. If either check fails after installation,
   it restores the previous Compose file and local image, starts the old Node
   service, checks both routes again, and preserves the original deployment
   failure. A successful rollout retains the previous Compose file and Docker
   image locally for a deliberate manual rollback.

The rollback protects a failed candidate deployment; it is not a zero-downtime
cutover. After a successful deployment, verify the public endpoint and a
representative Socket.IO connection before considering the release complete.

```bash
curl --fail https://api.penguincookie.ca/api/health
```

## Required GitHub configuration

The production environment requires these GitHub Actions secrets. Docker Hub
credentials are repository secrets used to build and push; EC2 credentials may
be repository secrets or production-environment secrets used by the deploy job:

- `DOCKER_HUB_USERNAME`
- `DOCKER_HUB_PASSWORD`
- `EC2_HOST`
- `EC2_SSH_KEY`
- `EC2_KNOWN_HOSTS`

`EC2_KNOWN_HOSTS` must contain the expected host-key entry obtained and
verified through a trusted administrative channel. Do not generate and trust a
fresh `ssh-keyscan` result inside the deployment job; doing so would remove the
host-identity check that the secret is intended to provide.

The EC2 host also needs:

- Docker Engine and the Docker Compose plugin;
- an `ubuntu` deployment user permitted to use Docker;
- `/home/ubuntu/Games-Arena/backend/.env`, protected from other users and
  containing the production MongoDB URI, application settings, and a
  32-byte-or-longer `JWT_SECRET` (the workflow enforces `NODE_ENV=production`
  and `CORS_ORIGIN=https://games.penguincookie.ca` during rollout);
- a valid TLS certificate for `api.penguincookie.ca`; and
- Nginx proxying both HTTP and Socket.IO traffic to the single backend service
  on `127.0.0.1:3000`.

When the API proxy configuration changes, install and validate the reviewed
`nginx-api.conf` intentionally, then run `nginx -t` before reloading Nginx. A
static `games_arena_backend` upstream may continue to point at port 3000; the
active deployment does not switch it between slots.

## Frontend deployment

The frontend is deployed independently by Vercel's Git integration from
`main`, with `frontend/` as the project root. Configure the production Vercel
environment so `VITE_API_URL` and `VITE_SOCKET_URL` both use
`https://api.penguincookie.ca`. No GitHub Actions workflow or GitHub deployment
secret is required for the Vercel release.

## Retained blue/green utilities

`blue-green-deploy.sh`, `switch-nginx-upstream.sh`, and the associated slot
switching/sudo files are retained in this directory for reference and possible
future reactivation. They are currently inactive and unreferenced by the
production deployment workflow. Do not install or invoke them as part of the
in-place Compose deployment. If `nginx-upstream.conf` is already installed, it
acts only as the static port-3000 upstream until an intentionally reviewed
Nginx change replaces it.
