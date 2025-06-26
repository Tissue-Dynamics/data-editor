# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web-based data analysis application that integrates Claude's AI capabilities for intelligent data validation, enrichment, and transformation. The frontend is now implemented with basic data table functionality.

## Current Status

### Frontend (Implemented)
- ✅ React + TypeScript with Vite
- ✅ TanStack Table for data grid with row/column selection
- ✅ Tailwind CSS for styling
- ✅ CSV and JSON file upload with Papaparse
- ✅ Visual validation indicators component (ready for integration)
- ⏳ Real-time WebSocket connections for streaming results

### Backend (Planned)
- Cloudflare Workers as main orchestrator
- Dynamic worker spawning for parallel Claude Code SDK tasks
- Cloudflare D1 for validation state persistence
- Cloudflare R2 for file storage

## Project Structure

```
data-editor/
├── frontend/               # React application
│   ├── src/
│   │   ├── components/    # UI components
│   │   │   ├── DataTable/ # Table with selection
│   │   │   └── Upload/    # File upload handling
│   │   ├── types/         # TypeScript definitions
│   │   └── App.tsx        # Main application
│   └── package.json
├── backend/               # Cloudflare Workers (empty)
├── test-data/             # Sample CSV/JSON files
└── SPEC.md               # Detailed specification

## Key Features to Implement

1. **Row-Level Validation**: Select rows → use Claude Code with web search to validate/fill missing values
2. **Column Testing**: Generate and persist validation rules (e.g., value ranges)
3. **Data Transformation**: Create calculated columns with visible formulas
4. **Parallel Processing**: Spawn multiple Claude Code instances for bulk validation
5. **Visual Validation States**: ✓ (valid), ⚠️ (warning), ❌ (error) indicators that clear on data change

## Development Commands

### Frontend (from frontend/ directory)
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Backend (not yet initialized)
```bash
# From backend/ directory
npm init -y
wrangler init

# Install dependencies
npm install @anthropic-ai/claude-code hono drizzle-orm
npm install -D @cloudflare/workers-types wrangler
```

### Testing
Test data files are available in the `test-data/` directory:
- `clinical-trials.csv` - Medical trial data with missing values
- `lab-measurements.csv` - Lab data for unit conversion testing
- `drug-discovery.json` - JSON format compound data

## Implementation Priority

1. **Phase 1 - Core Data Table**: Implement file upload, data display with TanStack Table, row/column selection
2. **Phase 2 - Claude Integration**: Add single-row validation with Claude Code SDK
3. **Phase 3 - Parallel Processing**: Implement worker spawning for bulk validation
4. **Phase 4 - Persistence**: Add validation state tracking with visual indicators

## Important Technical Decisions

- Each validation task spawns an independent Claude Code instance with web search access
- Validation results are stored in D1 with timestamps and automatically invalidated when data changes
- The UI shows real-time progress for parallel validation tasks
- Unit conversions and transformations create new columns rather than modifying existing data

## API Patterns

All tasks follow this pattern:
1. User selects data (rows/columns)
2. User provides natural language prompt
3. System spawns appropriate number of Claude Code workers
4. Results stream back and update visual indicators
5. Validation states persist until underlying data changes