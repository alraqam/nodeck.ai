# NoDeck API Specification

## Base URL
`http://localhost:8000/api/v1`

## Authentication

### Login
- **POST** `/auth/login`
- **Body**: `OAuth2PasswordRequestForm` (username, password)
- **Response**: `{ "access_token": "...", "token_type": "bearer" }`

### Register
- **POST** `/auth/register`
- **Body**:
```json
{
  "email": "user@example.com",
  "password": "strongpassword",
  "full_name": "John Doe",
  "role": "FOUNDER"
}
```

### Me
- **GET** `/users/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: User Object

## Startups

### Create Startup Profile
- **POST** `/startups`
- **Body**:
```json
{
  "name": "My Startup",
  "one_liner": "Uber for X",
  "stage": "PRE_SEED"
}
```
- **Response**: Startup Object (ID)

### Get Startup
- **GET** `/startups/{startup_id}`
- **Response**: Startup Object (including `sip_data`)

### Update SIP (Intelligence Data)
- **PUT** `/startups/{startup_id}/sip`
- **Body**: Partial `sip_data` JSON.
- **Response**: Updated Startup Object.

### Upload & Parse Pitch Deck (PDF)
- **POST** `/startups/{startup_id}/upload-deck`
- **File**: `file` (PDF)
- **Response**: `{ "status": "processing", "task_id": "..." }`
- **Note**: Triggers background job to parse PDF and auto-fill `sip_data`.

## Intelligence & Reports (AI)

### Trigger Fundability Analysis
- **POST** `/startups/{startup_id}/analyze`
- **Body**: (Optional settings)
- **Response**: `{ "report_id": "...", "status": "PENDING" }`

### Trigger Investment Memo Generation
- **POST** `/startups/{startup_id}/generate/memo`
- **Response**: `{ "report_id": "...", "status": "PENDING" }`

### Trigger Pitch Deck Generation
- **POST** `/startups/{startup_id}/generate/deck`
- **Response**: `{ "report_id": "...", "status": "PENDING" }`

### Generate Investor View
- **POST** `/startups/{startup_id}/investor-views`
- **Body**:
```json
{
  "investor_name": "Sequoia",
  "investor_thesis": "Marketplaces and AI"
}
```
- **Response**: `{ "view_id": "...", "status": "PENDING" }`

### Get Report Logic
- **GET** `/reports/{report_id}`
- **Response**: Report Object (status: COMPLETED/PENDING, content: JSON)
