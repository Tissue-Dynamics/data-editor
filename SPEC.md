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
- **Task Examples**:
  - **Validation**: Randomly sample and verify data accuracy using web research for X set of rows
  - **Research**: Fill missing fields using web research
  - **Testing**: Generate and run data quality tests on a column level basis
  - **Analysis**: Identify patterns, anomalies, correlations. General basic analysis
  - **Enrichment**: Add calculated fields or external data
  - **Cleaning**: Fix formatting, standardize values

- **Execution Modes**:
  - **Immediate**: Run on selected data instantly
  - **Batch**: Queue multiple tasks for processing
  - **Scheduled**: Regular validation runs

- **Result Handling**:
  - Real-time streaming of Claude's responses
  - Progress indicators for long-running tasks
  - Result caching and versioning
  - Export options (CSV, JSON, PDF report)

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
│   │   └── CellRenderer.tsx
│   ├── TaskPanel/
│   │   ├── TaskSelector.tsx
│   │   ├── PromptBuilder.tsx
│   │   └── ResultsView.tsx
│   ├── Upload/
│   │   ├── FileUploader.tsx
│   │   └── DataPreview.tsx
│   └── Common/
│       ├── StreamingOutput.tsx
│       └── ProgressIndicator.tsx
├── hooks/
│   ├── useDataSelection.ts
│   ├── useClaudeTask.ts
│   └── useWebSocket.ts
├── services/
│   ├── api.ts
│   ├── dataParser.ts
│   └── taskManager.ts
└── types/
    ├── data.ts
    └── tasks.ts
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

1. **Financial Data Validation**
   - Upload quarterly reports
   - Select specific columns (revenue, expenses)
   - Run validation to check calculations

2. **Clinical Trial Data Enrichment**
   - Upload trial catalyst data
   - Select rows with missing company names
   - Research and fill missing information

3. **E-commerce Inventory Audit**
   - Upload product catalog
   - Random sample 10% of items
   - Verify pricing and descriptions

4. **Customer Data Cleaning**
   - Upload CRM export
   - Select columns with formatting issues
   - Standardize phone numbers, addresses

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

### Create Task
```http
POST /api/tasks
Content-Type: application/json

{
  "datasetId": "ds_123",
  "type": "research",
  "selection": {
    "rows": [1, 5, 10, 15],
    "columns": ["Company", "Market_Cap"]
  },
  "config": {
    "maxTurns": 5,
    "priority": "high"
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
