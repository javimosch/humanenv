# Deployment Guidelines

## Remote Server

- **Host**: `188.245.71.48`
- **Port**: 22
- **User**: root
- **Path**: `/apps/humanenv`
- **Container**: `humanenv-server` (port 3056)
- **Domain**: `https://humanenv.intrane.fr` (Traefik/Coolify)

## Deployment Commands

```bash
# Create proxy config (Traefik routing)
node manage.js proxy
# Enter service name when prompted: humanenv-server

# Deploy app to remote (rsync + docker compose up)
node manage.js deploy

# Deploy domain to Traefik gateway
node manage.js domain
```

## Configuration

| File | Purpose |
|---|---|
| `.env` | Deployment vars (remote host, domain, MongoDB URI) |
| `compose.prod.yml` | Docker compose for pre-built image |

### Key .env vars

```
REMOTE_HOST=188.245.71.48
REMOTE_HOST_PATH=/apps/humanenv
REMOTE_SERVICE_IP=http://humanenv-server:3056
PUBLISHED_DOMAIN=https://humanenv.intrane.fr
COMPOSE_FILE=compose.prod.yml
MONGODB_URI=mongodb://...@188.245.71.48:27019/humanenv?authSource=admin
```

## Network

The container joins `coolify-shared` external network so Traefik can route to `humanenv-server:3056`.

## Troubleshooting

```bash
# Check container status
ssh root@188.245.71.48 "docker ps | grep humanenv"

# View logs
ssh root@188.245.71.48 "docker compose -f /apps/humanenv/compose.prod.yml logs -f"

# Restart
ssh root@188.245.71.48 "docker compose -f /apps/humanenv/compose.prod.yml restart"

# Check Traefik config
ssh root@188.245.71.48 "cat /data/coolify/proxy/dynamic/humanenv.yml"
```
