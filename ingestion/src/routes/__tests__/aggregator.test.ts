import express from 'express';
import request from 'supertest';

const runMock = jest.fn();
const runRangeMock = jest.fn();
const statusMock = jest.fn().mockReturnValue({ enabled: true });

class MockBusyError extends Error {}

jest.mock('../../services/aggregator', () => ({
  aggregatorService: {
    run: runMock,
    runRange: runRangeMock,
    getStatus: statusMock,
    start: jest.fn(),
    stop: jest.fn()
  },
  AggregatorBusyError: MockBusyError
}));

const { aggregatorRouter } = require('../aggregator');

const app = express();
app.use(express.json());
app.use('/aggregator', aggregatorRouter);

describe('aggregator routes', () => {
  const apiKey = 'test-key';

  beforeAll(() => {
    process.env.API_KEY = apiKey;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks requests without API key', async () => {
    const res = await request(app).get('/aggregator/status');
    expect(res.status).toBe(401);
    expect(statusMock).not.toHaveBeenCalled();
  });

  it('returns status when API key is provided', async () => {
    const res = await request(app).get('/aggregator/status').set('x-api-key', apiKey);
    expect(res.status).toBe(200);
    expect(statusMock).toHaveBeenCalled();
  });

  it('runs default aggregation when body empty', async () => {
    const res = await request(app).post('/aggregator/run').set('x-api-key', apiKey);
    expect(res.status).toBe(200);
    expect(runMock).toHaveBeenCalled();
  });

  it('runs a custom range when start/end provided', async () => {
    const body = { start: '2025-01-01T00:00:00Z', end: '2025-01-01T02:00:00Z' };
    const res = await request(app).post('/aggregator/run').set('x-api-key', apiKey).send(body);
    expect(res.status).toBe(200);
    expect(runRangeMock).toHaveBeenCalledTimes(1);
    const [start, end] = runRangeMock.mock.calls[0];
    expect(start).toBeInstanceOf(Date);
    expect(end).toBeInstanceOf(Date);
  });

  it('returns 400 for invalid ranges', async () => {
    const res = await request(app).post('/aggregator/run').set('x-api-key', apiKey).send({ start: 'bad', end: '2025-01-01T00:00:00Z' });
    expect(res.status).toBe(400);
    expect(runRangeMock).not.toHaveBeenCalled();
  });

  it('returns 409 when aggregator is busy', async () => {
    runMock.mockRejectedValueOnce(new MockBusyError('busy'));
    const res = await request(app).post('/aggregator/run').set('x-api-key', apiKey);
    expect(res.status).toBe(409);
  });
});
