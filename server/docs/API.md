# API Documentation

## Authentication

### POST `/api/auth/signup`
Creates a new user account.
- **Body**: `{ email, password, name, role }`
- **Role**: `Admin`, `Analyst`, `Viewer` (Default: `Viewer`)
- **Returns**: User object and JWT token.

### POST `/api/auth/signin`
Authenticates a user.
- **Body**: `{ email, password }`
- **Returns**: User object and JWT token.

---

## File Upload & Processing

### POST `/api/upload`
Uploads a file for reconciliation.
- **Auth**: Required
- **Form Data**: `{ file (CSV/XLSX), type (source/internal) }`
- **Returns**: Job ID for async tracking.

### GET `/api/upload/jobs`
Lists all upload jobs.
- **Auth**: Required
- **Returns**: Array of job status objects.

---

## Records & Reconciliation

### GET `/api/records`
Fetches reconciliation results.
- **Auth**: Required
- **Query Params**: `status`, `search`, `page`, `limit`
- **Returns**: Paginated list of records and their match statuses.

### GET `/api/records/:id/timeline`
Fetches the immutable audit trail for a specific record.
- **Auth**: Required
- **Returns**: Chronological list of audit logs.

### PUT `/api/records/:id/correct`
Manually updates a record's fields.
- **Auth**: Required (Admin/Analyst only)
- **Body**: `{ fieldsToUpdate }`
- **Side Effect**: Automatically creates an immutable audit log.

---

## Dashboard & Stats

### GET `/api/dashboard/stats`
Provides high-level reconciliation metrics.
- **Auth**: Required
- **Returns**: Count of matched, partial, duplicates, and total records.

---

## System Configuration

### GET `/api/config`
Fetches system-wide settings.
- **Auth**: Required
- **Returns**: Current configurations (e.g., Variance Threshold).

### POST `/api/config`
Updates system settings.
- **Auth**: Required (Admin only)
- **Body**: `{ varianceThreshold }`
- **Returns**: Updated configuration object.
