# Intelligence Access System Guide

## Overview

The Intelligence Access system provides a flexible way to manage AI model access with configurable prompts, fallback models, tokens, and usage tracking. It uses a denormalized database schema for performance and simplicity.

## Core Concepts

### Intelligence Access Record

An `intelligence_access` record is the central object that defines:
- **Key Hash**: SHA256 hash of the access token (stored in DB)
- **Access Type**: Determines how the access record is used
- **Available To**: JSON array for domain/IP restrictions
- **Details**: Denormalized configuration (models, prompts, encrypted keys)
- **Token Balance**: Credit balance for tracking usage costs
- **Max Tokens**: Optional limit on response length
- **Status**: `dev`, `prod`, or `hold` (controls logging and behavior)

### Access Types

| Type | Details Format | Description | API Usage |
|------|----------------|-------------|-----------|
| `open` | `[]` (empty array) | User passes full model config at runtime | Send `accessId`, `accessKey`, `query`, and optional `context` |
| `hybrid` | `["provider/model", "provider/model", ...]` | Models stored; keys provided at runtime | Send `accessId`, `accessKey`, `query`, and optional `context` |
| `closed` | `["prompt", "provider/model/enc(key)/tokenId", ...]` | Prompt, models, and keys stored (encrypted) | Send `accessId`, `accessKey`, `query`, and optional `context` |

### Access Status

| Status | Behavior |
|--------|----------|
| `prod` | No logging, standard behavior |
| `dev` | Logs all requests, responses, and errors |
| `hold` | Requests are rejected with an error |

## Database Schema

### Main Tables

#### `intelligence_access`

The primary denormalized table storing access records.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Auto-incrementing primary key |
| `key_hash` | TEXT | SHA256 hash of the access token (not the raw token) |
| `type` | TEXT | Access type: `open`, `hybrid`, `closed` |
| `available_to` | JSONB | JSON array for domain/IP restrictions (default: `[]`) |
| `details` | JSONB | Denormalized configuration based on type |
| `max_tokens` | INTEGER | Optional max tokens limit |
| `token_balance` | DOUBLE PRECISION | Credit balance (default: 0) |
| `status` | TEXT | Access status: `dev`, `prod`, `hold` |
| `updated_at` | TIMESTAMP(6) | Last update timestamp |

**Details Format by Type:**

- **`open`**: `[]` (empty array - no stored configuration)
- **`hybrid`**: `["provider/model", "provider/model", ...]` (models only, keys provided at runtime)
- **`closed`**: `["prompt", "provider/model/enc(key)/tokenId", ...]` (prompt + encrypted models/keys)

#### `accessTokens`

Stores provider API tokens.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Auto-incrementing primary key |
| `account_id` | TEXT | Owner account identifier |
| `name` | TEXT | User-friendly name for the token |
| `key` | TEXT | Raw API key |

#### `intelligence_models`

Stores reusable model configurations.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Auto-incrementing primary key |
| `title` | TEXT | Human-readable model name |
| `provider` | TEXT | Provider name (e.g., `openai`, `anthropic`) |
| `model` | TEXT | Model identifier |
| `description` | TEXT | Optional description |
| `currency` | TEXT | Currency for pricing (default: USD) |
| `inputPrice` | DOUBLE PRECISION | Cost per 1M input tokens |
| `outputPrice` | DOUBLE PRECISION | Cost per 1M output tokens |

#### `intelligence_log`

Usage logs with denormalized details.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Auto-incrementing primary key |
| `access_id` | BIGINT | Foreign key to `intelligence_access.id` |
| `details` | JSONB | `{ prompt: "...", context: "...", output: "..." }` |
| `from` | TEXT | Final token/model key identifier (provider/model/key_id) |
| `balance_used` | DOUBLE PRECISION | Amount of balance deducted |
| `logged_on` | TIMESTAMP(6) | Timestamp of the log |

#### `intelligence_settings`

Per-account settings.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Auto-incrementing primary key |
| `account_id` | TEXT | Unique account identifier |
| `dev_mode` | BOOLEAN | Enable development logging |

#### `openflow_usage_log`

Usage tracking for OpenFlow.

| Column | Type | Description |
|--------|------|-------------|
| `id` | BIGSERIAL | Auto-incrementing primary key |
| `account_id` | TEXT | Account identifier |
| `token_last4` | TEXT | Last 4 characters of token |
| `model_used` | TEXT | Model identifier |
| `provider` | TEXT | Provider name |
| `used_at` | TIMESTAMP(6) | Timestamp |

## How It Works

### Creating an Access Record

1. User navigates to `/intelligence/access/add`
2. Selects access type (`open`, `hybrid`, or `closed`)
3. Selects access status (`dev`, `prod`, or `hold`)
4. Configures model blocks:
   - **Primary block**: Row index 0
   - **Fallback blocks**: Row index 1+, saved in `details` array
5. For `closed` type:
   - Prompt and keys are encrypted using access key
   - Format: `provider/model/enc(key)/tokenId`
6. System generates:
   - Unique access token: e.g., `ncl_int_...`
7. Token is shown once and stored as SHA256 hash in database
8. Record is saved with all denormalized configuration in `details`
9. Redirects to `/intelligence/access` list

### Using an Access Record

The access record is called via the `/bridge/api.v1/intelligence/getResponse` endpoint.

#### Validation Steps

1. **Step 1**: Verify `accessKey` matches `key_hash` in database
   - If match fails: Return error response
2. **Step 2**: Get access type from record
3. **Step 3**: Process based on type:

   - **`open`**: Basic validation only. User provides full model config at runtime.
   - **`hybrid`**: Models in `details` array. User provides keys at runtime.
     - Fallback chain: Try 1st model, then 2nd, then 3rd, etc.
   - **`closed`**: Prompt in `details[0]`, models in `details[1..n]`
     - Decrypt each model entry using access key
     - Extract: `provider/model/enc(key)/tokenId`
     - Fallback chain: Try 1st, then 2nd, then 3rd, etc.

4. **Step 4**: Deduct balance based on input/output tokens generated
5. **Step 5**: Log to `intelligence_log` with denormalized details

### Model Fallback Mechanism

The system supports multiple fallback levels stored in the `details` JSONB field:

1. **Primary**: First entry in details array (index 0 for hybrid/closed)
2. **Fallbacks**: Additional entries (index 1, 2, 3, etc.)
3. When primary fails, the system attempts fallbacks in order
4. For `hybrid`: Only provider/model is stored
5. For `closed`: provider/model/enc(key)/tokenId format with encryption

### Balance Management

- Each access record has a `token_balance` field (default: 0)
- When a request is made, the cost is calculated and deducted
- Users can recharge balances via `/intelligence/logs/recharge?accessId=<id>`
- Balance tracking is stored per access record
- Logs include `balance_used` field showing amount deducted

### Logging

- **Dev mode**: All requests logged to `intelligence_log` with full details
- **Dev mode**: Detailed logs to `intelligence_devlog` with headers, bodies, errors
- **Prod mode**: Minimal or no logging

## Frontend Components

### Pages

| Path | Purpose |
|------|---------|
| `/intelligence/access` | List all access records |
| `/intelligence/access/add` | Create new access record |
| `/intelligence/access/[id]` | View/edit access record details |
| `/intelligence/tokens` | Manage provider tokens |
| `/intelligence/models` | Manage model configurations |
| `/intelligence/logs` | View usage logs |
| `/intelligence/logs/recharge` | Recharge access balance |

### Key Components

- **AccessCreateForm**: Handles creation of new access records with model blocks
- **AccessEditForm**: Updates existing access records
- **PageHeader**: Renders titles and breadcrumbs
- **Cards**: UI containers for displaying access records

## API Functions

### Store Functions (in `store.ts`)

| Function | Purpose |
|----------|---------|
| `getIntelligenceAccesses(accountId)` | Fetch all access records for account |
| `getIntelligenceAccessById(accountId, accessId)` | Fetch single access record |
| `getIntelligenceAccessByHash(accountId, keyHash)` | Fetch access by token hash |
| `getAccessTokens(accountId)` | Fetch provider tokens |
| `getIntelligenceModels()` | Fetch available models |
| `createIntelligenceAccessRecord(input)` | Create new access record |
| `updateIntelligenceAccessRecord(input)` | Update existing record |
| `deleteIntelligenceAccessRecord(input)` | Delete access record |
| `rechargeIntelligenceAccessBalance(input)` | Add balance to access record |
| `logIntelligenceUsage(input)` | Log usage with details |
| `deductBalance(input)` | Deduct balance from access |
| `getIntelligenceLogs(accountId)` | Fetch usage logs |

### Service Functions (in `intelligence-service.ts`)

Server actions that call store functions and handle:
- Form parsing and validation
- Redirects after successful operations
- Error handling and user feedback
- Path revalidation for Next.js caching

## Access Record Data Structure

```typescript
interface IntelligenceAccessRecord {
  id: number;
  key_hash: string;           // SHA256 hash of access token
  type: 'open' | 'hybrid' | 'closed';
  available_to: unknown;      // JSON array for domain/IP restrictions
  details: unknown;           // Denormalized config based on type
  max_tokens: number | null;
  token_balance: number;
  status: string;             // 'dev' | 'prod' | 'hold'
  updated_at: string;
}
```

### Details Format Examples

**Open Type:**
```json
[]
```

**Hybrid Type:**
```json
["openai/gpt-4", "anthropic/claude-3"]
```

**Closed Type:**
```json
[
  "You are a helpful assistant.",
  "openai/gpt-4/enc(abc123)/1",
  "anthropic/claude-3/enc(def456)/2"
]
```

## Encryption

For `closed` access type, values are encrypted using a simple XOR cipher with SHA256 hash of the access key:

```typescript
function encryptValue(value: string, accessKey: string): string {
  const accessKeyHash = sha256(accessKey);
  // XOR each character with corresponding key character
  return `enc_${base64_encode(encrypted)}`;
}

function decryptValue(encryptedValue: string, accessKey: string): string {
  // Reverse the XOR operation
}
```

To edit a `closed` access record, the user must pass the current access key to decrypt existing values.

## Security Notes

- Raw access tokens are **never** stored in the database
- Only SHA256 hashes are stored (`sha256:hexstring`)
- Token is shown once at creation and should be stored securely by the user
- Access tokens grant API access to the AI bridge
- For `closed` type, sensitive data (keys) is encrypted using the access key

## Migration Notes

The new schema replaces the normalized design with a denormalized one:

1. **Dropped Tables**:
   - `intelligenceAccess` (old normalized table)
   - `intelligence_access` (old view)
   - `intelligence_fallbacks` (no longer needed)

2. **New Tables**:
   - `intelligence_access` (new denormalized table)
   - Updated `intelligence_log` with denormalized `details` JSONB

3. **Key Changes**:
   - Single table for all access types
   - `details` JSONB stores all configuration
   - No foreign key dependencies for fallbacks
   - Balance tracked per record
