# Data Editor Backend

Cloudflare Workers backend for the Data Editor application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up your Anthropic API key:
```bash
wrangler secret put ANTHROPIC_API_KEY
```

3. Run the development server:
```bash
npm run dev
```

The backend will be available at http://localhost:8787

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /api/tasks/execute` - Execute a data analysis task
- `GET /api/tasks/:taskId` - Get task status

## Next Steps

1. Implement Claude integration in the task execution endpoint
2. Add D1 database for task persistence
3. Add R2 bucket for file storage
4. Implement WebSocket support for real-time updates