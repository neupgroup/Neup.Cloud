#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('node:fs');
const path = require('node:path');
const { NodeSSH } = require('node-ssh');
const dotenv = require('dotenv');
const { spawnSync } = require('node:child_process');

function die(message) {
  console.error(`cloud: ${message}`);
  process.exit(1);
}

function usage() {
  console.log(`
Usage:
  npx cloud init

Env (from .env in repo root):
  DATABASE_URL           postgresql://user:pass@host:5432/dbname?schema=public
  SERVER_PRIVATE_KEY     SSH private key contents (supports \\n or /n newlines)

Optional:
  SERVER_IP_ADDRESS      SSH host (preferred; defaults to DATABASE_URL host)
  SERVER_USER_NAME       SSH username (preferred; defaults to ubuntu, then root)
  SERVER_SSH_HOST        SSH host override (legacy)
  SERVER_SSH_USER        SSH username override (legacy)
  SERVER_SSH_PORT        SSH port (defaults to 22)

Notes:
  - Requires passwordless sudo on the server (sudo -n).
  - Configures Postgres to listen on all interfaces and allows 0.0.0.0/0 in pg_hba.conf.
  - Runs: npx prisma migrate deploy
`.trim());
}

function normalizePrivateKey(raw) {
  if (!raw) return raw;
  // Common cases:
  // - stored as literal \n sequences
  // - stored as /n sequences (legacy in this repo)
  let key = raw.trim();
  if (key.includes('\\n')) key = key.replace(/\\n/g, '\n');
  if (key.includes('/n') && key.includes('BEGIN') && key.includes('END')) {
    key = key.replace(/\/n/g, '\n');
  }
  return key;
}

function parseDatabaseUrl(databaseUrl) {
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    die('DATABASE_URL is not a valid URL.');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    die('DATABASE_URL must start with postgresql://');
  }

  const dbUser = decodeURIComponent(url.username || '');
  const dbPassword = decodeURIComponent(url.password || '');
  const dbName = (url.pathname || '').replace(/^\//, '');
  const host = url.hostname;
  const port = url.port ? Number(url.port) : 5432;

  if (!host) die('DATABASE_URL missing host.');
  if (!dbName) die('DATABASE_URL missing database name.');
  if (!dbUser) die('DATABASE_URL missing username.');

  return { host, port, dbName, dbUser, dbPassword };
}

async function main() {
  const [, , cmd] = process.argv;
  if (!cmd || cmd === '-h' || cmd === '--help') {
    usage();
    process.exit(cmd ? 0 : 1);
  }
  if (cmd !== 'init') {
    usage();
    die(`unknown command "${cmd}"`);
  }

  const repoRoot = process.cwd();
  const envPath = path.join(repoRoot, '.env');
  if (!fs.existsSync(envPath)) {
    die('missing .env in repo root.');
  }

  dotenv.config({ path: envPath });

  const databaseUrl = process.env.DATABASE_URL;
  const privateKeyRaw = process.env.SERVER_PRIVATE_KEY;
  if (!databaseUrl) die('DATABASE_URL is not set in .env.');
  if (!privateKeyRaw) die('SERVER_PRIVATE_KEY is not set in .env.');

  const { host: dbHost, port: dbPort, dbName, dbUser, dbPassword } = parseDatabaseUrl(databaseUrl);

  const sshHost = process.env.SERVER_IP_ADDRESS || process.env.SERVER_SSH_HOST || dbHost;
  const sshPort = process.env.SERVER_SSH_PORT ? Number(process.env.SERVER_SSH_PORT) : 22;
  const sshUserEnv = process.env.SERVER_USER_NAME || process.env.SERVER_SSH_USER;
  const sshUserCandidates = sshUserEnv ? [sshUserEnv] : ['ubuntu', 'root'];
  const privateKey = normalizePrivateKey(privateKeyRaw);

  const ssh = new NodeSSH();
  let connectedUser = null;
  for (const username of sshUserCandidates) {
    try {
      console.log(`cloud init: connecting to ${username}@${sshHost}:${sshPort} ...`);
      await ssh.connect({
        host: sshHost,
        port: sshPort,
        username,
        privateKey,
      });
      connectedUser = username;
      break;
    } catch (err) {
      if (sshUserEnv) throw err;
    }
  }
  if (!connectedUser) {
    die(`failed to connect to ${sshHost}:${sshPort} (tried users: ${sshUserCandidates.join(', ')})`);
  }

  const remoteScript = `
	set -e

DB_NAME=${JSON.stringify(dbName)}
DB_USER=${JSON.stringify(dbUser)}
DB_PASS=${JSON.stringify(dbPassword || '')}

	SUDO=""
	if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
	  SUDO="sudo -n"
	else
	  echo "ERROR: passwordless sudo is required (sudo -n)."
	  exit 3
	fi

	PSQL_AS_POSTGRES="$SUDO -u postgres psql"

echo "STEP: postgres-installed"
if command -v psql >/dev/null 2>&1; then
  echo "OK: psql already present"
else
  if command -v apt-get >/dev/null 2>&1; then
    $SUDO apt-get update -y
    $SUDO apt-get install -y postgresql postgresql-contrib
  elif command -v dnf >/dev/null 2>&1; then
    $SUDO dnf install -y postgresql-server postgresql
  elif command -v yum >/dev/null 2>&1; then
    $SUDO yum install -y postgresql-server postgresql
  else
    echo "ERROR: unsupported distro (no apt-get/dnf/yum). Install PostgreSQL manually."
    exit 4
  fi
fi

echo "STEP: postgres-service"
if command -v systemctl >/dev/null 2>&1; then
  $SUDO systemctl enable --now postgresql 2>/dev/null || true
  # Some distros use 'postgresql-XX' units; best-effort start any matching unit.
  unit=$($SUDO systemctl list-unit-files --type=service 2>/dev/null | awk '{print $1}' | grep -E '^postgresql.*\\.service$' | head -n1 || true)
  if [ -n "$unit" ]; then
    $SUDO systemctl enable --now "$unit" 2>/dev/null || true
  fi
fi

echo "STEP: role"
	ROLE_EXISTS=$($PSQL_AS_POSTGRES -tAc "SELECT 1 FROM pg_roles WHERE rolname='${dbUser.replace(/'/g, "''")}'" 2>/dev/null | tr -d '[:space:]' || true)
if [ "$ROLE_EXISTS" = "1" ]; then
  echo "OK: role exists"
else
	  $PSQL_AS_POSTGRES -v ON_ERROR_STOP=1 -c "CREATE ROLE \\"${dbUser.replace(/\"/g, '\"\"')}\\" LOGIN;" >/dev/null
  echo "OK: role created"
fi

echo "STEP: password"
if [ -n "$DB_PASS" ]; then
	  $PSQL_AS_POSTGRES -v ON_ERROR_STOP=1 -c "ALTER ROLE \\"${dbUser.replace(/\"/g, '\"\"')}\\" WITH PASSWORD '${(dbPassword || '').replace(/'/g, "''")}';" >/dev/null
  echo "OK: password set"
else
  echo "WARN: DATABASE_URL has empty password; leaving role password unchanged"
fi

echo "STEP: database"
	DB_EXISTS=$($PSQL_AS_POSTGRES -tAc "SELECT 1 FROM pg_database WHERE datname='${dbName.replace(/'/g, "''")}'" 2>/dev/null | tr -d '[:space:]' || true)
if [ "$DB_EXISTS" = "1" ]; then
  echo "OK: database exists"
else
	  $PSQL_AS_POSTGRES -v ON_ERROR_STOP=1 -c "CREATE DATABASE \\"${dbName.replace(/\"/g, '\"\"')}\\" OWNER \\"${dbUser.replace(/\"/g, '\"\"')}\\";" >/dev/null
  echo "OK: database created"
fi

	echo "STEP: ownership"
		$PSQL_AS_POSTGRES -v ON_ERROR_STOP=1 -c "ALTER DATABASE \\"${dbName.replace(/\"/g, '\"\"')}\\" OWNER TO \\"${dbUser.replace(/\"/g, '\"\"')}\\";" >/dev/null || true

	echo "STEP: config (listen + pg_hba)"
	CONFIG_FILE=$($PSQL_AS_POSTGRES -tAc "SHOW config_file" 2>/dev/null | tr -d '[:space:]' || true)
	HBA_FILE=$($PSQL_AS_POSTGRES -tAc "SHOW hba_file" 2>/dev/null | tr -d '[:space:]' || true)
	if [ -z "$CONFIG_FILE" ] || [ -z "$HBA_FILE" ]; then
	  echo "ERROR: could not locate PostgreSQL config files."
	  exit 6
	fi

	PW_ENC=$($PSQL_AS_POSTGRES -tAc "SHOW password_encryption" 2>/dev/null | tr -d '[:space:]' || true)
	HBA_METHOD="md5"
	if [ "$PW_ENC" = "scram-sha-256" ]; then
	  HBA_METHOD="scram-sha-256"
	fi

	# Ensure listen_addresses = '*'
	if $SUDO grep -Eq '^[[:space:]]*listen_addresses[[:space:]]*=' "$CONFIG_FILE" 2>/dev/null; then
	  $SUDO sed -i "s/^[[:space:]]*listen_addresses[[:space:]]*=.*/listen_addresses = '*'/" "$CONFIG_FILE"
	else
	  echo "listen_addresses = '*'" | $SUDO tee -a "$CONFIG_FILE" > /dev/null
	fi

	# Allow access from anywhere (IPv4)
	if ! $SUDO grep -Eq '^[[:space:]]*host[[:space:]]+all[[:space:]]+all[[:space:]]+0\\.0\\.0\\.0/0[[:space:]]+' "$HBA_FILE" 2>/dev/null; then
	  echo "host all all 0.0.0.0/0 $HBA_METHOD" | $SUDO tee -a "$HBA_FILE" > /dev/null
	fi

	echo "STEP: restart"
	if command -v systemctl >/dev/null 2>&1; then
	  unit=$($SUDO systemctl list-units --type=service 2>/dev/null | awk '{print $1}' | grep -E '^postgresql.*\\.service$' | head -n1 || true)
	  if [ -z "$unit" ]; then
	    unit=$($SUDO systemctl list-unit-files --type=service 2>/dev/null | awk '{print $1}' | grep -E '^postgresql.*\\.service$' | head -n1 || true)
	  fi
	  if [ -n "$unit" ]; then
	    $SUDO systemctl restart "$unit" 2>/dev/null || true
	  else
	    $SUDO systemctl restart postgresql 2>/dev/null || true
	  fi
	elif command -v service >/dev/null 2>&1; then
	  $SUDO service postgresql restart 2>/dev/null || true
	fi

	echo "STEP: firewall"
	if command -v ufw >/dev/null 2>&1; then
	  status=$(ufw status 2>/dev/null | head -n1 || true)
	  if echo "$status" | grep -qi active; then
	    $SUDO ufw allow 5432/tcp >/dev/null 2>&1 || true
	  fi
	fi

	echo "OK: done"
	`.trim();

  const result = await ssh.execCommand(remoteScript);
  ssh.dispose();

  if (result.code !== 0) {
    die(result.stderr || result.stdout || `remote init failed (exit ${result.code})`);
  }

  console.log('cloud init: complete.');
  console.log(`- Postgres ensured on ${sshHost}`);
  console.log(`- Database ensured: ${dbName}`);
  console.log(`- Role ensured: ${dbUser}`);
  console.log('');
  console.log('Tip: if port 5432 is not reachable from your machine, use an SSH tunnel:');
  console.log(`  ssh -i <keyfile> -L ${dbPort}:127.0.0.1:${dbPort} ${connectedUser}@${sshHost}`);

  console.log('');
  console.log('cloud init: running prisma migrations (migrate deploy) ...');
  const prismaResult = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'migrate', 'deploy'],
    { stdio: 'inherit', cwd: repoRoot, env: process.env }
  );
  if (prismaResult.status !== 0) {
    die('prisma migrate deploy failed. Ensure port 5432 is reachable from your machine (or use an SSH tunnel) and retry.');
  }
}

main().catch((err) => die(err?.message || String(err)));
