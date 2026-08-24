# NoDeck Database Schema

## Overview
We use PostgreSQL as the primary data store.
Key design decision: usage of `JSONB` for the Startup Intelligence Profile (SIP) to allow flexibility in the data structure as the product evolves, while keeping core relational data (Users, IDs, relationships) strict.

## ER Diagram
```mermaid
erDiagram
    USERS ||--o{ STARTUPS : owns
    STARTUPS ||--o{ REPORTS : has
    STARTUPS ||--o{ INVESTOR_VIEWS : has
    
    USERS {
        uuid id PK
        string email UK
        string hashed_password
        string full_name
        string role "FOUNDER | INVESTOR | ADMIN"
        timestamp created_at
        timestamp updated_at
    }

    STARTUPS {
        uuid id PK
        uuid founder_id FK
        string name
        string slug UK
        string one_liner
        string[] industry
        string stage "PRE_SEED | SEED | SERIES_A"
        jsonb sip_data "The Intelligence Profile"
        timestamp created_at
        timestamp updated_at
    }

    REPORTS {
        uuid id PK
        uuid startup_id FK
        string type "FUNDABILITY | MEMO | PITCH_DECK"
        string status "PENDING | COMPLETED | FAILED"
        jsonb content "AI Result"
        jsonb score_summary "Extracted scores"
        timestamp created_at
    }

    INVESTOR_VIEWS {
        uuid id PK
        uuid startup_id FK
        string investor_name
        string investor_thesis
        jsonb content "Tailored View"
        timestamp created_at
    }
```

## JSON Structures

### Startup Intelligence Profile (sip_data)
```json
{
  "identity": {
    "website": "https://...",
    "location": "San Francisco, CA",
    "founded_year": 2024
  },
  "problem": {
    "description": "...",
    "pain_points": ["Cost", "Speed"],
    "current_solutions": "Excel"
  },
  "solution": {
    "product_name": "NoDeck",
    "description": "...",
    "features": ["AI Scoring", "Memo Gen"],
    "tech_stack": ["AI", "Python"]
  },
  "market": {
    "total_addressable_market": 1000000000,
    "serviceable_obtainable_market": 50000000,
    "target_persona": "Founders"
  },
  "traction": {
    "stage": "MVP",
    "metrics": {
      "mau": 100,
      "mrr": 0
    }
  },
  "team": [
    {
      "name": "Jane Doe",
      "role": "CEO",
      "background": "Ex-Google"
    }
  ],
  "fundraising": {
    "ask": 500000,
    "valuation_cap": 5000000
  }
}
```
