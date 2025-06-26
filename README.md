# Data Editor

An interactive web application for scientific data validation and analysis powered by Claude AI.

## Overview

Data Editor enables researchers and data scientists to upload tabular data (CSV, JSON) and leverage Claude's AI capabilities with web search and computational tools to:

- **Validate scientific data** against research databases (PubChem, ChEMBL)
- **Fill missing values** using AI-powered research
- **Detect conflicts** and data quality issues
- **Track changes** with git-like version history
- **Confirm AI suggestions** with visual validation indicators

## Key Features

### 🔬 AI-Powered Validation
- Claude 3.5 Sonnet with web search capabilities
- Real-time streaming of analysis progress
- Scientific database lookups for compound validation
- Computational tools for molecular calculations

### 🎯 Smart Validation System
- **🟠 Orange orbs** - AI suggestions pending confirmation
- **🟢 Green orbs** - User-confirmed values
- **🔴 Red orbs** - Conflicts or unverifiable data
- **⚪ Grey orbs** - Unchecked cells
- Validation summary panel with detailed findings
- One-click application of research-backed values

### 📝 Version Control
- Git-like history timeline
- Navigate between data versions
- Undo/redo functionality
- Visual progress tracking

### 🚀 Performance
- Real-time Server-Sent Events (SSE) streaming
- Optimized for large datasets
- Cloudflare Workers edge computing
- Rate limit aware with automatic model switching

## Tech Stack

- **Frontend**: React + TypeScript + Vite + TanStack Table + Tailwind CSS
- **Backend**: Cloudflare Workers + Hono framework
- **AI**: Claude 3.5 Sonnet API with tool use (web search, bash)
- **Streaming**: Server-Sent Events for real-time progress
- **Testing**: Vitest + React Testing Library

## Current Status

### ✅ Implemented
- Complete frontend with data table and selection
- Backend API with Claude integration
- Real-time streaming of tool usage
- Validation orb system with visual indicators
- Version history with navigation
- Validation summary panel
- Batch operations (confirm all, dismiss all)
- Rate limit handling with model switching

### 🚧 In Progress
- D1 database integration for persistence
- R2 storage for large files
- Authentication system
- Export functionality

## Getting Started

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
# Add your Anthropic API key to .dev.vars
echo "ANTHROPIC_API_KEY=your-key-here" > .dev.vars
npm run dev
```

## Documentation

- [SPEC.md](SPEC.md) - Detailed technical specification
- [CLAUDE.md](CLAUDE.md) - AI assistant guidance and project status

## License

MIT