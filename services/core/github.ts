/**
 * GitHub/Git Repository Commands
 * Unified command definitions for Git operations
 */

export interface CommandDefinition {
    title: string;
    description: string;
    icon: string;
    status: 'published' | 'unpublished';
    type: 'normal' | 'destructive' | 'success';
    command: {
        preCommand?: string;
        mainCommand: string;
        postCommand?: string;
    };
}

export interface GitCommandContext {
    appLocation: string;
    repoUrl?: string;
    branch?: string;
    targetRef?: string;
    keyPath?: string;
    isPrivate?: boolean;
}

/**
 * ============================================================================
 * PUBLIC COMMANDS
 * ============================================================================
 */

export const clonePublic = (context: GitCommandContext): CommandDefinition => ({
    title: 'Clone Repository',
    description: 'Clone the repository from GitHub',
    icon: 'GitBranch',
    status: 'published',
    type: 'normal',
    command: {
        mainCommand: getPublicCloneCommand(
            context.appLocation,
            context.repoUrl!
        )
    }
});

export const pull = (context: GitCommandContext): CommandDefinition => ({
    title: 'Pull Changes',
    description: 'Pull latest changes from the repository',
    icon: 'Download',
    status: 'published',
    type: 'normal',
    command: {
        mainCommand: getPullCommand(
            context.appLocation,
            context.branch || 'main'
        )
    }
});

export const pullForce = (context: GitCommandContext): CommandDefinition => ({
    title: 'Force Pull',
    description: 'Force pull and overwrite local changes',
    icon: 'Download',
    status: 'published',
    type: 'destructive',
    command: {
        mainCommand: getPullForceCommand(
            context.appLocation,
            context.branch || 'main'
        )
    }
});

export const reset = (context: GitCommandContext): CommandDefinition => ({
    title: 'Reset',
    description: 'Reset to a specific commit or branch',
    icon: 'RotateCcw',
    status: 'published',
    type: 'destructive',
    command: {
        mainCommand: getResetCommand(
            context.appLocation,
            context.targetRef || 'origin/main'
        )
    }
});

/**
 * ============================================================================
 * PRIVATE COMMANDS
 * ============================================================================
 */

export const clonePrivate = (context: GitCommandContext): CommandDefinition => ({
    title: 'Clone Repository',
    description: 'Clone private repository using SSH key',
    icon: 'GitBranch',
    status: 'published',
    type: 'normal',
    command: {
        mainCommand: getPrivateCloneCommand(
            context.appLocation,
            context.repoUrl!,
            context.keyPath || '/root/.ssh/id_ed25519'
        )
    }
});

export const pullPrivate = (context: GitCommandContext): CommandDefinition => ({
    title: 'Pull Changes',
    description: 'Pull latest changes from private repository',
    icon: 'Download',
    status: 'published',
    type: 'normal',
    command: {
        mainCommand: getPrivatePullCommand(
            context.appLocation,
            context.keyPath || '/root/.ssh/id_ed25519',
            context.branch || 'main'
        )
    }
});

export const pullForcePrivate = (context: GitCommandContext): CommandDefinition => ({
    title: 'Force Pull',
    description: 'Force pull from private repository',
    icon: 'Download',
    status: 'published',
    type: 'destructive',
    command: {
        mainCommand: getPrivatePullForceCommand(
            context.appLocation,
            context.keyPath || '/root/.ssh/id_ed25519',
            context.branch || 'main'
        )
    }
});

export const resetPrivate = (context: GitCommandContext): CommandDefinition => ({
    title: 'Reset',
    description: 'Reset private repository to a ref',
    icon: 'RotateCcw',
    status: 'published',
    type: 'destructive',
    command: {
        mainCommand: getPrivateResetCommand(
            context.appLocation,
            context.keyPath || '/root/.ssh/id_ed25519',
            context.targetRef || 'origin/main'
        )
    }
});

/**
 * ============================================================================
 * COMMAND GENERATORS (ROBUST + FAIL-FAST)
 * ============================================================================
 */

export const getPublicCloneCommand = (appLocation: string, repoUrl: string) => `
set -e

if [ -z "${repoUrl}" ]; then
  echo "❌ ERROR: Repository URL is missing"
  exit 1
fi

mkdir -p "${appLocation}"
cd "${appLocation}"

TEMP_DIR="temp_clone_$(date +%s)"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "🚀 Cloning repository..."
if ! git clone "${repoUrl}" "$TEMP_DIR"; then
  echo "❌ Git clone failed"
  exit 1
fi

shopt -s dotglob
cp -rf "$TEMP_DIR"/* .
shopt -u dotglob

echo "✅ Clone completed successfully"
`;

export const getPrivateCloneCommand = (
    appLocation: string,
    repoUrl: string,
    keyPath: string
) => `
set -e

if [ ! -f "${keyPath}" ]; then
  echo "❌ ERROR: SSH key not found at ${keyPath}"
  exit 1
fi

chmod 600 "${keyPath}"

mkdir -p "${appLocation}"
cd "${appLocation}"

TEMP_DIR="temp_clone_$(date +%s)"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

export GIT_SSH_COMMAND="ssh -i ${keyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"

echo "🚀 Cloning private repository..."
if ! git clone "${repoUrl}" "$TEMP_DIR"; then
  echo "❌ Private git clone failed (check SSH key & repo access)"
  exit 1
fi

shopt -s dotglob
cp -rf "$TEMP_DIR"/* .
shopt -u dotglob

echo "✅ Private clone completed successfully"
`;

export const getPullCommand = (appLocation: string, branch: string) => `
set -e
cd "${appLocation}"
git pull origin "${branch}"
`;

export const getPrivatePullCommand = (
    appLocation: string,
    keyPath: string,
    branch: string
) => `
set -e
cd "${appLocation}"
export GIT_SSH_COMMAND="ssh -i ${keyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
git pull origin "${branch}"
`;

export const getPullForceCommand = (appLocation: string, branch: string) => `
set -e
cd "${appLocation}"
git fetch --all
git reset --hard "origin/${branch}"
`;

export const getPrivatePullForceCommand = (
    appLocation: string,
    keyPath: string,
    branch: string
) => `
set -e
cd "${appLocation}"
export GIT_SSH_COMMAND="ssh -i ${keyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
git fetch --all
git reset --hard "origin/${branch}"
`;

export const getResetCommand = (appLocation: string, targetRef: string) => `
set -e
cd "${appLocation}"
git fetch --all
git reset --hard "${targetRef}"
`;

export const getPrivateResetCommand = (
    appLocation: string,
    keyPath: string,
    targetRef: string
) => `
set -e
cd "${appLocation}"
export GIT_SSH_COMMAND="ssh -i ${keyPath} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
git fetch --all
git reset --hard "${targetRef}"
`;

export const getAuthenticatedCloneCommand = (appLocation: string, repoUrl: string) => `
set -e

if [ -z "${repoUrl}" ]; then
  echo "ERROR: Repository URL is missing"
  exit 1
fi

if [ -z "\${GITHUB_AUTH_HEADER:-}" ]; then
  echo "ERROR: GitHub auth header is missing"
  exit 1
fi

mkdir -p "${appLocation}"
cd "${appLocation}"

TEMP_DIR="temp_clone_$(date +%s)"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

echo "Cloning private repository..."
if ! git -c http.https://github.com/.extraheader="$GITHUB_AUTH_HEADER" clone "${repoUrl}" "$TEMP_DIR"; then
  echo "ERROR: Private git clone failed"
  exit 1
fi

shopt -s dotglob
cp -rf "$TEMP_DIR"/* .
shopt -u dotglob

echo "Clone completed successfully"
`;

export const getAuthenticatedPullCommand = (appLocation: string, repoUrl: string, branch: string) => `
set -e

if [ -z "\${GITHUB_AUTH_HEADER:-}" ]; then
  echo "ERROR: GitHub auth header is missing"
  exit 1
fi

cd "${appLocation}"
git -c http.https://github.com/.extraheader="$GITHUB_AUTH_HEADER" pull "${repoUrl}" "${branch}"
`;

export const getAuthenticatedPullForceCommand = (appLocation: string, repoUrl: string, branch: string) => `
set -e

if [ -z "\${GITHUB_AUTH_HEADER:-}" ]; then
  echo "ERROR: GitHub auth header is missing"
  exit 1
fi

cd "${appLocation}"
git -c http.https://github.com/.extraheader="$GITHUB_AUTH_HEADER" fetch "${repoUrl}" "${branch}"
git reset --hard FETCH_HEAD
`;

export const getAuthenticatedResetCommand = (appLocation: string, repoUrl: string, branch: string) => `
set -e

if [ -z "\${GITHUB_AUTH_HEADER:-}" ]; then
  echo "ERROR: GitHub auth header is missing"
  exit 1
fi

cd "${appLocation}"
git -c http.https://github.com/.extraheader="$GITHUB_AUTH_HEADER" fetch "${repoUrl}" "${branch}"
git reset --hard FETCH_HEAD
`;

export const getAuthenticatedPushCommand = (appLocation: string, repoUrl: string, branch: string) => `
set -e

if [ -z "\${GITHUB_AUTH_HEADER:-}" ]; then
  echo "ERROR: GitHub auth header is missing"
  exit 1
fi

cd "${appLocation}"
git -c http.https://github.com/.extraheader="$GITHUB_AUTH_HEADER" push "${repoUrl}" "HEAD:${branch}"
`;
