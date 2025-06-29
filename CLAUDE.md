# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web-based data analysis application that integrates Claude's AI capabilities for intelligent data analysis tasks. Users describe what they want to do in natural language, and Claude figures out the best approach. The frontend is now implemented with basic data table functionality.

## Current Status (Updated: January 2025)

### Frontend (✅ Fully Implemented)
- React + TypeScript with Vite
- TanStack Table for data grid with row/column selection
- Tailwind CSS v3 for styling
- CSV and JSON file upload with Papaparse
- Visual validation indicators with orb system
- Git-like version history component
- Validation summary panel for AI findings
- Real-time SSE streaming for task progress
- TypeScript type checking and ESLint configured
- Pre-validation on dev/build commands

### Backend (✅ Fully Implemented)
- Cloudflare Workers with Hono framework
- Claude 3.5 Sonnet integration with tool use
- Web search for scientific data validation
- Bash execution for calculations
- Real-time streaming with Server-Sent Events
- Two-phase conversation for research + structured output
- Rate limit handling with automatic model switching

### Database & Storage (⏳ Next Phase)
- Cloudflare D1 for validation state persistence
- Cloudflare R2 for file storage
- Session management and multi-user support

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
├── backend/               # Cloudflare Workers API
├── test-data/             # Sample CSV/JSON files
└── SPEC.md               # Detailed specification

## Session Summary: What We Accomplished

### 🎯 Validation System Overhaul
1. **New Orb Colors** (as requested by user):
   - 🟠 Orange: AI suggestions pending confirmation
   - 🟢 Green: User-confirmed values
   - 🔴 Red: Conflicts or unverifiable data
   - ⚪ Grey: Unchecked cells
   - Click orbs to confirm/validate
   - Batch operations: "Confirm All" and "Dismiss All"

2. **Real-Time Progress Streaming**
   - Implemented Server-Sent Events (SSE)
   - Shows actual Claude tool usage:
     - "Searching scientific databases"
     - "Running calculations"
     - "Generating validation results"
   - Fixed completion handling for task steps
   - Replaced spin animation with pulse for better UX

3. **Smart Validation Logic**
   - No longer auto-applies estimates
   - Distinguishes research-backed values from guesses
   - Shows validation summary with all findings
   - Users manually apply trusted suggestions
   - Validation messages explain Claude's reasoning

4. **Git-Like Version History**
   - Redesigned with minimalist horizontal timeline
   - Clickable dots for direct navigation
   - Compact design (~60% smaller)
   - Auto-hides when only one version
   - Smooth animations and hover effects

5. **Technical Improvements**
   - Fixed `c.streamText` error with proper `ReadableStream`
   - Switched to Claude 3.5 Sonnet for better rate limits
   - Implemented two-phase conversation:
     - Phase 1: Research with tools
     - Phase 2: Structured output
   - Fixed tool_result handling for proper API flow
   - Optimized prompts to reduce token usage

## Next Immediate Tasks

1. **Complete Validation Summary**
   - Wire up the ValidationSummary component fully
   - Add filtering and sorting options
   - Implement "Apply All Non-Estimates" button

2. **Persistence Layer**
   - Create D1 database tables
   - Implement validation caching
   - Add session management

3. **Enhanced Features**
   - Export validated data with changelog
   - Keyboard shortcuts for navigation
   - Column-level validation rules
   - Bulk operations UI

## Development Commands

### Frontend (from frontend/ directory)
```bash
# Install dependencies
npm install

# Run development server (with validation)
npm run dev

# Run development server (skip validation for faster startup)
npm run dev:only

# Build for production (with validation)
npm run build

# Build for production (skip validation)
npm run build:only

# Run validation only (type-check + lint)
npm run validate

# Preview production build
npm run preview
```

### Code Quality
- TypeScript type checking runs automatically before dev/build
- ESLint runs automatically before dev/build
- Use `npm run dev:only` or `npm run build:only` to skip validation
- All imports of types must use `import type` syntax

### Backend (Now Implemented!)
```bash
# From backend/ directory
npm install    # Install all dependencies
npm run dev    # Start local development server on port 8787

# Configuration
# Add your Anthropic API key to .dev.vars:
echo "ANTHROPIC_API_KEY=sk-ant-api..." > .dev.vars
```

### Testing
Test data files are available in the `test-data/` directory:
- `clinical-trials.csv` - Medical trial data with missing values
- `lab-measurements.csv` - Lab data for unit conversion testing
- `drug-discovery.json` - JSON format compound data

## Implementation Priority

1. **Phase 1 - Core Data Table**: ✅ COMPLETED - File upload, data display with TanStack Table, row/column selection
2. **Phase 2 - Claude Integration**: Add single-row validation with Claude Code SDK
3. **Phase 3 - Parallel Processing**: Implement worker spawning for bulk validation
4. **Phase 4 - Persistence**: Add validation state tracking with visual indicators

## Zed Editor Tasks

Two tasks are configured in Zed:
- **Dev: Full Stack**: Starts both backend (port 8787) and frontend (port 5173) with validation
- **Dev: Full Stack (Fast)**: Same as above but skips frontend validation for faster startup

## Important Technical Decisions

- Each validation task spawns an independent Claude Code instance with web search access
- Validation results are stored in D1 with timestamps and automatically invalidated when data changes
- The UI shows real-time progress for parallel validation tasks
- Unit conversions and transformations create new columns rather than modifying existing data

## API Patterns

### Current Task Flow
1. User selects data and enters prompt
2. Backend initiates two-phase Claude conversation:
   - Phase 1: Research with web search and calculations
   - Phase 2: Structured output generation
3. Real-time SSE streaming shows tool usage
4. Validation summary displays findings
5. User confirms or dismisses suggestions
6. Version history tracks all changes

### Validation States
- **auto_updated**: AI applied change, pending confirmation
- **confirmed**: User validated the value
- **conflict**: Conflicting or unverifiable data
- **unchecked**: No validation performed

## Key Technical Decisions

- **Model**: Claude 3.5 Sonnet (better rate limits than Claude-4)
- **Streaming**: Server-Sent Events (SSE) over WebSockets
- **Tool Use**: Two-phase approach for research + output
- **UI/UX**: Professional design without emojis
- **Validation**: Only apply research-backed values, not estimates
- **Frontend**: Vite for fast HMR, TanStack Table for performance

## Recent Improvements (January 2025)

### 🚀 Performance Optimizations
1. **Component Architecture Refactoring**
   - Split large components into smaller, focused units
   - Implemented React.memo for all major components
   - Created custom virtualization for large datasets
   - Memoized table columns to prevent recreation

2. **Memory Leak Fixes**
   - Implemented LRU cache with TTL for backend
   - Added automatic cleanup for completed tasks
   - Proper memory management for validation state

3. **Type Safety Improvements**
   - Eliminated all `any` types from codebase
   - Fixed React 19 compatibility issues
   - Added proper error boundaries throughout
   - Improved TypeScript strictness

4. **Context API Implementation**
   - Eliminated props drilling with 5 specialized contexts
   - Better state management and separation of concerns
   - Improved component reusability

5. **UI/UX Enhancements**
   - Fixed table cell heights (max 4rem with scroll)
   - Better text wrapping and overflow handling
   - Consistent row heights across the table
   - Improved validation indicator design

### Component Structure
```
components/
├── Common/
│   └── ErrorBoundary.tsx      # Error handling
├── DataTable/
│   ├── DataTable.tsx          # Main table component
│   ├── VirtualDataTable.tsx   # Virtualized table
│   └── ValidationIndicator.tsx # Status indicators
├── ValidationSummary/
│   ├── ValidationSummary.tsx  # Main container
│   ├── ValidationStats.tsx    # Statistics display
│   ├── ValidationGroupItem.tsx # Grouped items
│   ├── ValidationItemDisplay.tsx # Individual items
│   ├── ValidationAnalysis.tsx # Analysis section
│   └── RowDeletionsList.tsx  # Deletion suggestions
├── SessionManager/            # Session handling
├── WorkArea/                  # Main work area
└── [other components...]
```

### Context Providers
- **DataContext**: Data and selection management
- **ValidationContext**: Validation state and operations
- **SessionContext**: Session management
- **TaskContext**: Task execution and history
- **HistoryContext**: Version history and navigation