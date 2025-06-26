# Dynamic Data Analysis Web App Specification

## Overview
A web application that allows users to upload and interact with tabular data (CSV/JSON), select specific rows or columns, and leverage Claude Code SDK to perform intelligent analysis tasks such as data validation, research for missing fields, and quality checks.

## Architecture Overview

### Frontend
- **Framework**: React with TypeScript
- **Data Table**: TanStack Table for advanced data grid functionality
- **State Management**: TanStack Query for server state
- **UI Components**: Tailwind CSS + shadcn/ui
- **File Handling**: Papaparse for CSV parsing

### Backend
- **Primary Server**: Cloudflare Workers
- **Task Execution**: Dynamic Cloudflare Workers (Workers for Platforms)
- **AI Integration**: Claude Code SDK (`@anthropic-ai/claude-code`)
- **Database**: Cloudflare D1 (SQLite)
- **File Storage**: Cloudflare R2
- **Queue**: Cloudflare Queues for task management

### Infrastructure
- **CDN**: Cloudflare Pages for frontend hosting
- **API**: REST/JSON with WebSocket support for streaming
- **Authentication**: Cloudflare Zero Trust or custom JWT

## Core Features

### 1. Data Display & Selection
- **Upload Support**: CSV, JSON, Excel files up to 100MB
- **Interactive Table**:
  - Row selection (checkbox, click, range)
  - Column selection (header click, multi-select)
  - Cell-level selection for precise analysis
- **Data Operations**:
  - Sort by any column
  - Filter with complex conditions
  - Search across all fields
  - Pagination for large datasets
  - Column reordering and resizing

### 2. Claude Code Integration

#### Core Task Scenarios

1. **Row-Level Validation & Research**
   - **Missing Value Completion**: Select rows → "Fill in missing values for these rows"
     - Claude Code activates per row using web search and other tools
     - Returns JSON with validated/filled values
     - Visual indicators show which cells were validated/updated
   
   - **Bulk Verification**: "Take 20 of these rows and double check that they are correct"
     - Spawns parallel workers using Claude Code SDK
     - Each worker validates a row independently
     - Compiles results showing error percentage
     - Updates cell validation symbols (✓ for valid, ⚠️ for errors)

2. **Column-Level Testing & Validation**
   - **Value Range Testing**: Select column → "Write a test to ensure values are between 0-100µM"
     - Generates and executes validation test
     - Visually indicates which rows pass/fail
     - Validation symbols persist until data changes
     - When cell value changes, validation symbol is removed

3. **Data Transformation & Enrichment**
   - **Unit Conversion**: Select columns → "Create new column converting ng/mL to µM based on molecular weight"
     - Generates transformation logic
     - Creates new calculated column
     - Maintains data lineage and formula visibility

4. **Cell-Level Validation States**
   - **Visual Indicators**:
     - ✓ Green check: Validated and correct
     - ⚠️ Yellow warning: Validation found issues
     - 🔄 Blue spinner: Validation in progress
     - ❌ Red X: Validation failed or error
     - No symbol: Not yet validated or validation outdated
   
   - **Validation Persistence**:
     - Validation results stored with timestamp
     - Symbols cleared when underlying data changes
     - Ability to re-validate previously validated data

#### Execution Architecture

- **Parallel Processing**:
  - Row-by-row processing with independent Claude Code instances
  - Configurable concurrency limits (e.g., 5-20 parallel workers)
  - Progress tracking across all workers
  - Result aggregation and error handling

- **Tool Integration**:
  - Each Claude Code instance has access to:
    - Web search for fact verification
    - Calculator for numeric validations
    - Custom tools specific to domain (e.g., chemical databases)

- **Result Format**:
  ```json
  {
    "row_id": "123",
    "validations": {
      "company_name": {
        "status": "validated",
        "confidence": 0.95,
        "source": "web_search",
        "notes": "Verified via company website"
      },
      "trial_phase": {
        "status": "corrected",
        "original": "Phase 2",
        "corrected": "Phase 3",
        "source": "clinicaltrials.gov"
      }
    },
    "overall_status": "validated_with_corrections"
  }
  ```

### 3. Dynamic Task System
- **Worker Architecture**:
  - Main orchestrator worker handles routing
  - Dedicated workers spawned per task type
  - Resource isolation and monitoring
  - Automatic scaling based on load

- **Task Management**:
  - Visual task queue with priorities
  - Pause, resume, cancel capabilities
  - Task templates for common operations
  - History and audit trail

### 4. Advanced Features
- **Data Versioning**: Track changes over time
- **Collaboration**: Share datasets and results
- **Custom Prompts**: User-defined analysis templates
- **Webhooks**: Integrate with external systems
- **API Access**: Programmatic task submission

## Technical Implementation

### Frontend Components

```typescript
// Core component structure
src/
├── components/
│   ├── DataTable/
│   │   ├── DataTable.tsx
│   │   ├── SelectionControls.tsx
│   │   ├── ColumnHeader.tsx
│   │   ├── CellRenderer.tsx
│   │   ├── ValidationIndicator.tsx    // Shows ✓, ⚠️, ❌ states
│   │   └── CellTooltip.tsx            // Shows validation details on hover
│   ├── TaskPanel/
│   │   ├── TaskSelector.tsx
│   │   ├── PromptBuilder.tsx
│   │   ├── ResultsView.tsx
│   │   └── ValidationSummary.tsx      // Shows overall validation stats
│   ├── Upload/
│   │   ├── FileUploader.tsx
│   │   └── DataPreview.tsx
│   └── Common/
│       ├── StreamingOutput.tsx
│       ├── ProgressIndicator.tsx
│       └── ParallelTaskMonitor.tsx    // Shows progress of parallel workers
├── hooks/
│   ├── useDataSelection.ts
│   ├── useClaudeTask.ts
│   ├── useWebSocket.ts
│   └── useValidationState.ts          // Manages cell validation states
├── services/
│   ├── api.ts
│   ├── dataParser.ts
│   ├── taskManager.ts
│   └── validationCache.ts             // Caches validation results
└── types/
    ├── data.ts
    ├── tasks.ts
    └── validation.ts                   // Validation state types
```

#### Key UI Components

**ValidationIndicator Component**
```typescript
interface ValidationState {
  status: 'validated' | 'warning' | 'error' | 'pending' | null;
  timestamp: Date;
  source?: string;
  notes?: string;
  confidence?: number;
}

// Displays appropriate icon based on validation state
// Clears automatically when cell data changes
```

**ParallelTaskMonitor Component**
```typescript
interface ParallelTaskProgress {
  totalTasks: number;
  completed: number;
  inProgress: number;
  failed: number;
  results: ValidationResult[];
}

// Real-time progress bar and statistics
// Shows individual worker status
```

### Backend API Design

```typescript
// Main Worker API endpoints
POST   /api/upload          // Upload dataset
GET    /api/datasets        // List datasets
GET    /api/dataset/:id     // Get dataset with data

POST   /api/tasks           // Create new task
GET    /api/tasks           // List tasks
GET    /api/task/:id        // Get task status/results
DELETE /api/task/:id        // Cancel task

// WebSocket endpoints
WS     /ws/task/:id         // Stream task results

// Task Worker Pattern
interface TaskWorker {
  async execute(data: SelectedData, config: TaskConfig): AsyncIterator<TaskResult>
}

// Example task definitions
const TASK_DEFINITIONS = {
  validate: {
    systemPrompt: "You are a data validation expert...",
    userPromptTemplate: "Validate the following data: {data}"
  },
  research: {
    systemPrompt: "You are a research assistant...",
    userPromptTemplate: "Research and fill missing values for: {fields} in {data}"
  },
  test: {
    systemPrompt: "You are a QA engineer...",
    userPromptTemplate: "Generate data quality tests for: {schema}"
  }
}
```

### Claude Code SDK Integration

```typescript
import { query } from "@anthropic-ai/claude-code";

export class ClaudeTaskExecutor {
  async executeTask(
    taskType: TaskType,
    data: SelectedData,
    config: TaskConfig
  ): AsyncIterator<TaskResult> {
    const prompt = this.buildPrompt(taskType, data, config);

    const messages = query({
      prompt,
      options: {
        maxTurns: config.maxTurns || 5,
        model: config.model || "claude-4-sonnet",
        tools: config.enabledTools || ["web_search", "calculator"]
      }
    });

    for await (const message of messages) {
      yield this.processMessage(message);
    }
  }
}
```

### Database Schema

```sql
-- Cloudflare D1 Schema
CREATE TABLE datasets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  row_count INTEGER,
  column_count INTEGER,
  file_url TEXT,
  metadata JSON
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  dataset_id TEXT REFERENCES datasets(id),
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  config JSON,
  result JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE TABLE task_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT REFERENCES tasks(id),
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  event_type TEXT,
  data JSON
);

-- New tables for validation tracking
CREATE TABLE cell_validations (
  id TEXT PRIMARY KEY,
  dataset_id TEXT REFERENCES datasets(id),
  row_index INTEGER NOT NULL,
  column_name TEXT NOT NULL,
  validation_status TEXT NOT NULL, -- 'validated', 'warning', 'error'
  original_value TEXT,
  validated_value TEXT,
  confidence REAL,
  source TEXT,
  notes TEXT,
  task_id TEXT REFERENCES tasks(id),
  validated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  invalidated_at DATETIME, -- Set when cell value changes
  UNIQUE(dataset_id, row_index, column_name, invalidated_at)
);

CREATE TABLE validation_rules (
  id TEXT PRIMARY KEY,
  dataset_id TEXT REFERENCES datasets(id),
  column_name TEXT,
  rule_type TEXT NOT NULL, -- 'range', 'pattern', 'custom'
  rule_config JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast validation lookups
CREATE INDEX idx_cell_validations_lookup 
ON cell_validations(dataset_id, row_index, column_name, invalidated_at);
```

## Security Considerations

1. **API Key Management**
   - Store Anthropic API key in Cloudflare secrets
   - Optional: Allow users to provide their own keys
   - Rate limiting per user/key

2. **Data Privacy**
   - Client-side encryption option for sensitive data
   - Data retention policies
   - GDPR compliance features

3. **Access Control**
   - Role-based permissions (viewer, editor, admin)
   - Dataset-level sharing controls
   - Audit logging for all operations

## Performance Optimization

1. **Frontend**
   - Virtual scrolling for large datasets
   - Web Workers for heavy computations
   - Lazy loading of results

2. **Backend**
   - Edge caching for repeated queries
   - Result deduplication
   - Intelligent task batching

## Deployment Strategy

### Phase 1: MVP (2-3 weeks)
- Basic file upload and display
- Simple row/column selection
- Single task type (validation)
- Direct Claude Code SDK integration

### Phase 2: Core Features (3-4 weeks)
- All task types implemented
- Streaming results
- Task history and caching
- Basic authentication

### Phase 3: Advanced Features (4-6 weeks)
- Dynamic worker system
- Custom prompt templates
- Collaboration features
- API access

### Phase 4: Enterprise Features (6-8 weeks)
- Advanced security options
- White-label support
- Usage analytics
- SLA monitoring

## Cost Estimation

### Cloudflare Costs (Monthly)
- Workers: $5 (10M requests)
- D1: $5 (10GB storage)
- R2: $15 (100GB storage)
- Queues: $5 (1M operations)

### Claude API Costs
- Variable based on usage
- Estimate: $0.01-0.10 per task
- Consider usage-based pricing model

## Success Metrics

1. **Performance**
   - Task completion time < 30s for standard operations
   - UI responsiveness < 100ms
   - 99.9% uptime

2. **User Experience**
   - Intuitive selection interface
   - Clear task progress indication
   - Helpful error messages

3. **Business**
   - Cost per task < $0.05
   - User retention > 60%
   - Task success rate > 95%

## Future Enhancements

1. **AI Capabilities**
   - Multi-model support (GPT-4, Gemini)
   - Custom fine-tuned models
   - Automated insight generation

2. **Integrations**
   - Google Sheets sync
   - Database connectors
   - BI tool exports

3. **Advanced Analytics**
   - Trend detection
   - Predictive modeling
   - Automated reporting

## Development Tools & Libraries

### Frontend Dependencies
```json
{
  "@tanstack/react-table": "^8.x",
  "@tanstack/react-query": "^5.x",
  "papaparse": "^5.x",
  "lucide-react": "^0.x",
  "tailwindcss": "^3.x",
  "@radix-ui/react-*": "latest",
  "react-hook-form": "^7.x",
  "zod": "^3.x"
}
```

### Backend Dependencies
```json
{
  "@anthropic-ai/claude-code": "latest",
  "@cloudflare/workers-types": "^4.x",
  "hono": "^3.x",
  "drizzle-orm": "^0.x",
  "zod": "^3.x"
}
```

## Example Use Cases

1. **Clinical Trial Data Validation**
   - Upload trial catalyst data with missing values
   - Select rows with incomplete data → "Fill in missing company names and trial phases"
   - Claude Code searches clinical trial databases and company websites
   - Visual indicators show ✓ for validated cells, with source attribution
   - Select "Phase" column → "Ensure all values are valid clinical trial phases"
   - System generates test, marks invalid entries with ⚠️

2. **Laboratory Data Quality Control**
   - Upload concentration measurements in various units
   - Select concentration columns → "Convert all values to µM using molecular weights from column B"
   - Creates new standardized column with formulas visible
   - Select 20 random rows → "Double-check these measurements are within expected ranges"
   - Parallel validation shows 95% accuracy rate, flags 1 outlier

3. **Drug Discovery Data Enrichment**
   - Upload compound screening results
   - Select IC50 column → "Validate that all values are between 0.01-100µM"
   - Rows outside range get ⚠️ warning indicators
   - When scientist corrects a flagged value, validation symbol automatically clears
   - Re-run validation after corrections to ensure data quality

4. **Research Publication Verification**
   - Upload dataset from published paper
   - Click "Validate Random Sample" → "Take 30 rows and verify against original sources"
   - System spawns 30 parallel workers, each using web search
   - Results show 93% match rate, 7% have minor discrepancies
   - Each validated cell shows ✓ with timestamp and source

## API Documentation Preview

### Upload Dataset
```http
POST /api/upload
Content-Type: multipart/form-data

{
  "file": <binary>,
  "name": "Clinical Trials 2025",
  "description": "Q1 catalyst data"
}
```

### Create Validation Task
```http
POST /api/tasks
Content-Type: application/json

{
  "datasetId": "ds_123",
  "type": "validate_rows",
  "prompt": "Fill in missing values for these rows",
  "selection": {
    "rows": [1, 5, 10, 15],
    "columns": ["Company", "Market_Cap", "Trial_Phase"]
  },
  "config": {
    "parallel_workers": 4,
    "tools": ["web_search"],
    "max_turns": 5
  }
}
```

### Create Column Test Task
```http
POST /api/tasks
Content-Type: application/json

{
  "datasetId": "ds_123",
  "type": "column_test",
  "prompt": "Write a test to ensure values are between 0-100µM",
  "selection": {
    "columns": ["IC50_Value"]
  },
  "config": {
    "test_type": "range",
    "persist_validation": true
  }
}
```

### Create Transformation Task
```http
POST /api/tasks
Content-Type: application/json

{
  "datasetId": "ds_123",
  "type": "transform",
  "prompt": "Convert ng/mL to µM using molecular weight from MW_Column",
  "selection": {
    "source_columns": ["Concentration_ng_mL", "MW_Column"],
    "target_column": "Concentration_uM"
  },
  "config": {
    "formula_visible": true,
    "create_new_column": true
  }
}
```

### Stream Results
```javascript
const ws = new WebSocket('wss://api.example.com/ws/task/task_456');
ws.onmessage = (event) => {
  const result = JSON.parse(event.data);
  console.log(result.message);
};
```
