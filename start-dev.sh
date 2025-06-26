#!/bin/bash

echo "🚀 Starting Full Stack Development..."
echo "📦 Backend: http://localhost:8787"
echo "🎨 Frontend: http://localhost:5173 (or 5174 if 5173 is busy)"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up cleanup trap
trap cleanup SIGINT SIGTERM

echo "[BACKEND] Starting backend..."
(cd backend && npm run dev) &
BACKEND_PID=$!

echo "[BACKEND] Waiting for backend to start..."
sleep 5

echo "[FRONTEND] Starting frontend..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "✅ Both services starting..."
echo "📝 Check browser console (F12) for frontend errors"
echo "🔧 Use Ctrl+C to stop both services"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID