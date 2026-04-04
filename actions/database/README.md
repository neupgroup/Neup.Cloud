# Database Actions

This directory contains all database-related server actions, organized by database engine.

## Structure

```
src/actions/database/
├── index.ts                    # Unified API - import from here
├── types.ts                    # Shared TypeScript types
├── common.ts                   # Common operations (installation, listing)
├── mariadb/
│   ├── operations.ts          # MariaDB-specific operations
│   └── settings.ts            # MariaDB settings management
└── postgresql/
    ├── operations.ts          # PostgreSQL-specific operations
    └── settings.ts            # PostgreSQL settings management
```

## Usage

### Recommended: Import from the unified API

```typescript
import {
    checkDatabaseInstallation,
    getDatabaseDetails,
    createDatabaseUser,
    executeDatabaseQuery,
    // ... other functions
} from '@/actions/database';
```

The unified API automatically routes operations to the correct engine based on the `engine` parameter.

### Engine-Specific Imports (Advanced)

If you need engine-specific functionality:

```typescript
// MariaDB only
import { executeMariaDBQuery } from '@/actions/database/mariadb/operations';

// PostgreSQL only
import { executePostgresQuery } from '@/actions/database/postgresql/operations';
```

## Available Operations

### Common Operations (All Engines)

- `checkDatabaseInstallation(serverId)` - Check which engines are installed
- `installDatabaseEngine(serverId, engine)` - Install MariaDB or PostgreSQL
- `listAllDatabases(serverId)` - List all databases across all engines

### Database Management

- `getDatabaseDetails(serverId, engine, dbName)` - Get database info
- `createDatabaseInstance(serverId, engine, dbName, user, pass)` - Create database
- `getDatabaseTables(serverId, engine, dbName)` - List all tables

### User Management

- `listDatabaseUsers(serverId, engine, dbName)` - List users
- `createDatabaseUser(serverId, engine, dbName, username, password, permissions)` - Create user
- `deleteDatabaseUser(serverId, engine, dbName, username, host)` - Delete user
- `updateDatabaseUserPermissions(serverId, engine, dbName, username, host, permissions)` - Update permissions
- `updateDatabaseUserPassword(serverId, engine, username, newPassword, host)` - Change password

### Query & Backup

- `executeDatabaseQuery(serverId, engine, dbName, query)` - Execute SQL query
- `generateDatabaseBackup(serverId, engine, dbName, mode)` - Generate backup

### Settings

- `saveDatabaseSettings(serverId, engine, dbName, settings)` - Save settings
- `getDatabaseSettings(serverId, engine, dbName)` - Get settings

## Types

All types are exported from `@/actions/database/types`:

```typescript
import type {
    DatabaseInstallation,
    DatabaseInstance,
    DatabaseDetails,
    DatabaseUser,
    DatabaseTable,
    OperationResult,
    BackupResult,
    QueryResult,
    DatabaseSettings,
    EngineStatus
} from '@/actions/database';
```

## Migration from Old Structure

The old `/app/database/actions.ts` file now re-exports from this new structure for backward compatibility. However, new code should import directly from `@/actions/database`.

### Before (deprecated):
```typescript
import { createDatabaseUser } from '@/app/server/database/actions';
```

### After (recommended):
```typescript
import { createDatabaseUser } from '@/actions/database';
```

## Benefits of New Structure

1. **Separation of Concerns** - Engine-specific code is isolated
2. **Type Safety** - Centralized type definitions
3. **Maintainability** - Easier to find and update engine-specific logic
4. **Testability** - Individual engines can be tested independently
5. **Scalability** - Easy to add new database engines in the future
