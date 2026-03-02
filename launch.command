#!/bin/bash

# Navigate to the directory where this script is located
cd "$(dirname "$0")"

echo "Killing any prior running instances on port 3000..."
# Find and kill any process listening on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null

echo "Starting Dreamable.studio..."

# Open the browser in the background after a short delay to let the server start
(sleep 3 && open http://localhost:3000) &

# Start the Next.js development server
npm run dev
