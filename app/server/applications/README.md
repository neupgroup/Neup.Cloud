# Applications Module

This module manages applications deployed in your infrastructure.

## Database Schema

Applications are stored in Firestore under the `applications` collection with the following structure:

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Name of the application |
| `location` | `string` | Yes | File path where the application is located on the server (e.g., `/var/www/myapp`) |
| `language` | `string` | Yes | Programming language or framework (e.g., "Node.js", "Python", "React") |
| `repository` | `string` | No | Git repository URL (GitHub, GitLab, etc.) |
| `networkAccess` | `string[]` | No | Array of ports the application uses (e.g., `["8080", "3000:80"]`) |
| `commands` | `Record<string, string>` | No | Key-value pairs of commands (e.g., `{"start": "npm start", "stop": "npm stop"}`) |
| `information` | `Record<string, any>` | No | Additional metadata stored as JSON |
| `owner` | `string` | Yes | User ID of the application owner |
| `createdAt` | `string` | Auto | ISO timestamp of creation |
| `updatedAt` | `string` | Auto | ISO timestamp of last update |

### Example Document

```json
{
  "name": "My Web App",
  "location": "/var/www/myapp",
  "language": "Node.js",
  "repository": "https://github.com/username/myapp",
  "networkAccess": ["3000", "8080:80"],
  "commands": {
    "start": "npm start",
    "stop": "npm stop",
    "restart": "npm restart",
    "build": "npm run build"
  },
  "information": {
    "version": "1.0.0",
    "environment": "production",
    "database": "postgresql"
  },
  "owner": "user123",
  "createdAt": "2026-01-11T12:00:00.000Z",
  "updatedAt": "2026-01-11T12:00:00.000Z"
}
```

## Usage

### Creating an Application

```typescript
import { createApplication } from '@/app/server/applications/actions';

const appId = await createApplication({
  name: 'My App',
  location: '/var/www/myapp',
  language: 'Node.js',
  repository: 'https://github.com/user/repo',
  networkAccess: ['3000'],
  commands: {
    start: 'npm start',
    stop: 'npm stop'
  },
  information: {
    version: '1.0.0'
  },
  owner: 'user-id-123'
});
```

### Getting Applications

```typescript
import { getApplications, getApplication } from '@/app/server/applications/actions';

// Get all applications
const apps = await getApplications();

// Get specific application
const app = await getApplication('app-id');
```

### Updating an Application

```typescript
import { updateApplication } from '@/app/server/applications/actions';

await updateApplication('app-id', {
  networkAccess: ['3000', '8080'],
  commands: {
    ...existingCommands,
    deploy: 'npm run deploy'
  }
});
```

### Deleting an Application

```typescript
import { deleteApplication } from '@/app/server/applications/actions';

await deleteApplication('app-id');
```

## Pages

- `/server/applications` - List all applications
- `/server/applications/new` - Create a new application
- `/server/applications/[id]` - View application details

## Components

- `ApplicationForm` - Form for creating/editing applications
- `ApplicationCard` - Card component for displaying application in list view
- `ApplicationCardSkeleton` - Loading skeleton for application cards
