# Production blue/green deployment prerequisites

The GitHub deployment workflow stages an immutable backend image on one of two
loopback-only slots:

- blue: `127.0.0.1:3001`
- green: `127.0.0.1:3002`

The currently active container remains available while the candidate starts and
passes its Docker health check. Nginx is then reloaded with the candidate slot,
and the workflow calls `https://api.penguincookie.ca/api/health` through the
local TLS listener. A failed switch or post-cutover check restores the previous
Nginx slot, Compose file, and running container. After success, the previous
container is removed but its exact image ID remains tagged as
`games-arena-backend:rollback-<image-id>`. `deployment-state.env` records that
local recovery tag and, once the previous release came from the hardened
pipeline, its immutable registry digest as `ROLLBACK_REFERENCE`.

GitHub serializes production jobs, and the host script also holds
`/home/ubuntu/Games-Arena/backend/.deploy.lock` with `flock` so a manual run
cannot overlap an automated deployment. If Nginx rollback cannot be confirmed,
the script deliberately leaves the candidate running instead of removing a
container that Nginx may still reference.

## One-time EC2 setup

These privileged host changes are intentionally **not** performed by Codex or
by an unprivileged deployment job. Back up the active Nginx configuration first,
identify and remove or replace the existing `api.penguincookie.ca` server block,
then install the reviewed files from this directory:

```bash
sudo install -o root -g root -m 0755 \
  switch-nginx-upstream.sh \
  /usr/local/sbin/games-arena-switch-upstream

sudo install -o root -g root -m 0644 \
  nginx-upstream.conf \
  /etc/nginx/conf.d/games-arena-upstream.conf

sudo install -o root -g root -m 0644 \
  nginx-api.conf \
  /etc/nginx/conf.d/games-arena-api.conf

sudo visudo -cf games-arena-deploy.sudoers
sudo install -o root -g root -m 0440 \
  games-arena-deploy.sudoers \
  /etc/sudoers.d/games-arena-deploy

sudo nginx -t
sudo systemctl reload nginx
sudo -u ubuntu sudo -n /usr/local/sbin/games-arena-switch-upstream --check
```

`nginx -T` must show exactly one `games_arena_backend` upstream and both the
HTTP and Socket.IO locations must proxy to it. The initial upstream points to
the legacy service on port 3000, so the first workflow run can migrate without
an outage. Do not end the maintenance window until the local TLS health check
passes:

```bash
curl --fail --resolve api.penguincookie.ca:443:127.0.0.1 \
  https://api.penguincookie.ca/api/health
```

The sudo rule grants only the root-owned switch helper. That helper accepts one
of `--check`, `--current`, `--version`, `3000`, `3001`, or `3002`; it validates
Nginx before and after every atomic upstream replacement and restores the old
file if reload fails. Reinstall the helper intentionally whenever its required
version changes in the repository.

The production user still needs Docker access, the existing protected `.env`,
the pinned `EC2_KNOWN_HOSTS` GitHub secret, and a valid certificate for
`api.penguincookie.ca`. AWS OIDC/SSM migration requires account-specific IAM,
instance-profile, and SSM resources and remains an external prerequisite; the
workflow therefore retains pinned-host SSH until those resources exist.
