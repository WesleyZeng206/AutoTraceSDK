import { NextRequest } from 'next/server';
import { proxyToIngestion } from '@/lib/api-proxy';

export async function GET(request: NextRequest) {
  return proxyToIngestion(request, '/v1/ml/llm/events');
}
