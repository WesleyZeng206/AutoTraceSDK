# AutoTrace

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

A simple program for tracking HTTP requests across your Node.js/Express.js applications. All you have to do is drop in the middleware, start up the backend, and get all the services you need without lots of complexity.

## Brief Overview

- Express.js middleware that captures request/response telemetry
- Backend service to collect and aggregate metrics
- Dashboard to visualize latency, errors, and anomalies
- Automatic anomaly detection using statistical analysis
- Team-based access control

## Quick start with Docker

**Requirements:** Docker and Docker Compose (Using Docker Desktop is recommended if you're new to docker)

1. Clone and start everything:
```bash
git clone https://github.com/WesleyZeng206/AutoTraceSDK.git
cd AutoTraceSDK
docker-compose up -d
```

The tech stack includes PostgreSQL, Redis, the ingestion service with Express.js and TypeScript, and the dashboard powered by Next.js.

2. Open the dashboard at `http://localhost:3000` and create an account.

3. Create an API key from the dashboard.

## Add the key to your service

Install the client:
```bash
npm install autotracesdk
```

Add the middleware to your Express app (example below):
```typescript
import express from 'express';
import { createAutoTraceSDKMiddleware } from 'autotracesdk';

const app = express();

app.use(createAutoTraceSDKMiddleware({
  serviceName: 'my-service',
  ingestionUrl: 'http://localhost:4000/telemetry',
  apiKey: 'your-api-key-from-dashboard'
}));

// add your routes here
app.get('/users', (request, response) => {
  response.json({ ... });
});

app.listen(5050);
```

Make some requests and check the dashboard. Metrics update in real-time. Aggregations are run hourly.

## Running Components

- **Dashboard**: `http://localhost:3000` - Dashboard/Website
- **Ingestion**: `http://localhost:4000/telemetry` - API endpoint for telemetry
- **PostgreSQL**: `localhost:5432` - Database
- **Redis**: `localhost:6379` - Caching (optional but enabled by default)

## Configuration

The docker-compose file has defaults for local development. For production, check `.env.production.example` and update:

- `SESSION_SECRET` - Change this to something random (32+ chars)
- `ALLOWED_ORIGINS` - Set to your dashboard URL
- `REDIS_ENABLED` - Turn it off if you don't need any caching
- Database credentials

## Development

Run tests:
```bash
cd client && npm test
cd ingestion && npm test
```

Build for production:
```bash
cd client && npm run build
cd ingestion && npm run build
cd dashboard && npm run build
```

## Notes

More documentation is provided in the dashboard's frontend when you run the application.

## License

MIT
