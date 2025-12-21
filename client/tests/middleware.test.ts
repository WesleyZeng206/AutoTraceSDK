import { Request, Response, NextFunction } from 'express';
import { createAutoTraceMiddleware, createAutoTraceErrorHandler } from '../src/middleware';
import { AutoTraceConfig } from '../src/types';

// Mock dependencies
jest.mock('../src/sending');
jest.mock('../src/batching');

import { createSender } from '../src/sending';
import { EventBatcher } from '../src/batching';

describe('AutoTrace Middleware', () => {
  let config: AutoTraceConfig;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;
  let mockBatcherAdd: jest.Mock;
  let mockBatcherStop: jest.Mock;

  beforeEach(() => {
    config = {
      serviceName: 'test-service',
      ingestionUrl: 'http://localhost:4000/telemetry',
      debug: false,
    };

    mockRequest = {
      method: 'GET',
      route: {
        path: '/test',
      } as any,
    } as Request;

    mockBatcherAdd = jest.fn();
    mockBatcherStop = jest.fn();

    // Mock EventBatcher
    (EventBatcher as jest.Mock).mockImplementation(() => ({
      add: mockBatcherAdd,
      stop: mockBatcherStop,
      getQueueSize: jest.fn().mockReturnValue(0),
    }));

    // Mock createSender
    (createSender as jest.Mock).mockReturnValue(jest.fn().mockResolvedValue(true));

    const responseEvents: Record<string, Function[]> = {};

    mockResponse = {
      statusCode: 200,
      locals: {},
      once: jest.fn((event: string, callback: Function) => {
        if (!responseEvents[event]) {
          responseEvents[event] = [];
        }
        responseEvents[event].push(callback);
        return mockResponse as Response;
      }) as any,
      emit: ((event: string) => {
        if (responseEvents[event]) {
          responseEvents[event].forEach(cb => cb());
        }
        return true;
      }) as any,
    } as Response;

    nextFunction = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAutoTraceMiddleware', () => {
    it('should create middleware function', () => {
      const middleware = createAutoTraceMiddleware(config);
      expect(typeof middleware).toBe('function');
    });

    it('should call next() immediately', () => {
      const middleware = createAutoTraceMiddleware(config);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledTimes(1);
    });

    it('should capture telemetry on response finish', () => {
      const middleware = createAutoTraceMiddleware(config);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      // Simulate response finish
      (mockResponse as any).emit('finish');

      expect(mockBatcherAdd).toHaveBeenCalledTimes(1);
      expect(mockBatcherAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          service_name: 'test-service',
          route: '/test',
          method: 'GET',
          status_code: 200,
          request_id: expect.any(String),
          timestamp: expect.any(String),
          duration_ms: expect.any(Number),
        })
      );
    });

    it('should capture telemetry on response close', () => {
      const middleware = createAutoTraceMiddleware(config);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      (mockResponse as any).emit('close');

      expect(mockBatcherAdd).toHaveBeenCalledTimes(1);
    });

    it('should only log event once when both finish and close fire', () => {
      const middleware = createAutoTraceMiddleware(config);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      (mockResponse as any).emit('finish');
      (mockResponse as any).emit('close');

      // Should only be called once
      expect(mockBatcherAdd).toHaveBeenCalledTimes(1);
    });

    it('should use req.path as fallback when req.route is undefined', () => {
      mockRequest = {
        method: 'GET',
        path: '/fallback-path',
        route: undefined,
      } as Request;

      const middleware = createAutoTraceMiddleware(config);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      (mockResponse as any).emit('finish');

      expect(mockBatcherAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          route: '/fallback-path',
        })
      );
    });

    it('should capture HTTP errors for 4xx status codes', () => {
      mockResponse.statusCode = 404;

      const middleware = createAutoTraceMiddleware(config);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      (mockResponse as any).emit('finish');

      expect(mockBatcherAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 404,
          error_type: 'HTTP_ERROR',
          error_message: '',
        })
      );
    });

    it('should capture HTTP errors for 5xx status codes', () => {
      mockResponse.statusCode = 500;

      const middleware = createAutoTraceMiddleware(config);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      (mockResponse as any).emit('finish');

      expect(mockBatcherAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 500,
          error_type: 'HTTP_ERROR',
          error_message: '',
        })
      );
    });

    it('should use error info from res.locals when available (4xx status)', () => {
      mockResponse.statusCode = 400;
      mockResponse.locals = {
        errorType: 'ValidationError',
        errorMessage: 'Invalid input',
      };

      const middleware = createAutoTraceMiddleware(config);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      (mockResponse as any).emit('finish');

      expect(mockBatcherAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          error_type: 'ValidationError',
          error_message: 'Invalid input',
        })
      );
    });

    it('should use error info from res.locals even with 2xx status code', () => {
      mockResponse.statusCode = 200;
      mockResponse.locals = {
        errorType: 'BusinessLogicError',
        errorMessage: 'Payment failed but request succeeded',
      };

      const middleware = createAutoTraceMiddleware(config);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      (mockResponse as any).emit('finish');

      expect(mockBatcherAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 200,
          error_type: 'BusinessLogicError',
          error_message: 'Payment failed but request succeeded',
        })
      );
    });

    describe('sampling behavior', () => {
      it('should drop events when the sampling rate is 0', () => {
        config.sampling = { samplingRate: 0 };
        const middleware = createAutoTraceMiddleware(config);
        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        (mockResponse as any).emit('finish');

        expect(mockBatcherAdd).not.toHaveBeenCalled();
      });

      it('should always sample errors when its configured', () => {
        config.sampling = { samplingRate: 0 };
        mockResponse.statusCode = 500;

        const middleware = createAutoTraceMiddleware(config);
        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        (mockResponse as any).emit('finish');

        expect(mockBatcherAdd).toHaveBeenCalledTimes(1);
      });

      it('should sample slow requests above minimum threshold', () => {
        jest.useFakeTimers();
        config.sampling = { samplingRate: 0, alwaysSampleSlow: 100 };

        const middleware = createAutoTraceMiddleware(config);
        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        jest.advanceTimersByTime(200);
        (mockResponse as any).emit('finish');

        expect(mockBatcherAdd).toHaveBeenCalledTimes(1);
        jest.useRealTimers();
      });

      it('should apply route sampling rules', () => {
        config.sampling = {
          samplingRate: 0,
          routeRules: [{ pattern: '/test', rate: 1 }],
        };

        const middleware = createAutoTraceMiddleware(config);
        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        (mockResponse as any).emit('finish');

        expect(mockBatcherAdd).toHaveBeenCalledTimes(1);
      });

      it('should work with custom sampler returning boolean', () => {
        config.sampling = {
          samplingRate: 1,
          customSampler: () => false,
        };

        const middleware = createAutoTraceMiddleware(config);
        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        (mockResponse as any).emit('finish');

        expect(mockBatcherAdd).not.toHaveBeenCalled();
      });

      it('should increase the sampling probability using priority sampler', () => {
        config.sampling = {
          samplingRate: 0.01,
          prioritySampler: () => 200,
        };

        const middleware = createAutoTraceMiddleware(config);
        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        (mockResponse as any).emit('finish');

        expect(mockBatcherAdd).toHaveBeenCalledTimes(1);
      });
    });

    it('should default error message to the empty string when res.locals.errorMessage is missing', () => {
      mockResponse.statusCode = 502;
      mockResponse.locals = {
        errorType: 'UpstreamError',
        errorMessage: '',
      };

      const middleware = createAutoTraceMiddleware(config);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      (mockResponse as any).emit('finish');

      expect(mockBatcherAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          error_type: 'UpstreamError',
          error_message: '',
          status_code: 502,
        })
      );
    });

    it('should catch synchronous errors in next() and propagate them', () => {
      const error = new Error('Sync error');
      let callCount = 0;
      const throwingNext = jest.fn(() => {
        callCount++;
        if (callCount === 1) {
          throw error;
        }
      });

      const middleware = createAutoTraceMiddleware(config);

      middleware(mockRequest as Request, mockResponse as Response, throwingNext);

      // Should be called twice: once initially (throws), once with error
      expect(throwingNext).toHaveBeenCalledTimes(2);
      expect(throwingNext).toHaveBeenLastCalledWith(error);
      expect(mockResponse.locals?.errorType).toBe('Error');
      expect(mockResponse.locals?.errorMessage).toBe('Sync error');
    });

    it('should capture telemetry when next() throws synchronously', () => {
      const syncError = new Error('Immediate failure');
      const throwingNext = jest
        .fn()
        .mockImplementationOnce(() => {
          throw syncError;
        })
        .mockImplementation(() => undefined);

      const middleware = createAutoTraceMiddleware(config);
      middleware(mockRequest as Request, mockResponse as Response, throwingNext);

      (mockResponse as any).emit('finish');

      expect(mockBatcherAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          error_type: 'Error',
          error_message: 'Immediate failure',
          status_code: 200,
        })
      );
    });

    it('should capture errors reported via error handler even for successful responses', () => {
      const middleware = createAutoTraceMiddleware(config);
      const errorHandler = createAutoTraceErrorHandler(config);

      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      const asyncError = new Error('Async handler boom');
      errorHandler(asyncError, mockRequest as Request, mockResponse as Response, jest.fn());

      (mockResponse as any).emit('finish');

      expect(mockBatcherAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          status_code: 200,
          error_type: 'Error',
          error_message: 'Async handler boom',
        })
      );
    });

    it('should measure request duration accurately', async () => {
      jest.useFakeTimers();

      const middleware = createAutoTraceMiddleware(config);
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      // Advance time by 250ms
      jest.advanceTimersByTime(250);

      (mockResponse as any).emit('finish');

      expect(mockBatcherAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          duration_ms: 250,
        })
      );

      jest.useRealTimers();
    });
  });

  describe('createAutoTraceErrorHandler', () => {
    let errorHandler: ReturnType<typeof createAutoTraceErrorHandler>;
    let error: Error;

    beforeEach(() => {
      errorHandler = createAutoTraceErrorHandler(config);
      error = new Error('Test error');
      error.name = 'TestError';
    });

    it('should create error handler function', () => {
      expect(typeof errorHandler).toBe('function');
      expect(errorHandler.length).toBe(4); // Error handlers have 4 parameters
    });

    it('should set error type and message in res.locals', () => {
      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.locals?.errorType).toBe('TestError');
      expect(mockResponse.locals?.errorMessage).toBe('Test error');
    });

    it('should call next with error', () => {
      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith(error);
    });

    it('should handle errors without name property', () => {
      const errorWithoutName = new Error('No name');
      delete (errorWithoutName as any).name;

      errorHandler(errorWithoutName, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.locals?.errorType).toBe('Error');
    });

    it('should handle errors without message property', () => {
      const errorWithoutMessage = new Error();
      (errorWithoutMessage as any).message = undefined;

      errorHandler(errorWithoutMessage, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(mockResponse.locals?.errorMessage).toBe('Something went wrong');
    });

    it('should log error when debug is enabled', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const debugConfig = { ...config, debug: true };
      const debugErrorHandler = createAutoTraceErrorHandler(debugConfig);

      debugErrorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(consoleSpy).toHaveBeenCalledWith('AutoTrace caught error:', error);

      consoleSpy.mockRestore();
    });

    it('should not log when debug is disabled', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      errorHandler(error, mockRequest as Request, mockResponse as Response, nextFunction);

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Integration: Middleware + Error Handler', () => {
    it('should work together to capture errors', () => {
      const middleware = createAutoTraceMiddleware(config);
      const errorHandler = createAutoTraceErrorHandler(config);

      // Set up middleware
      middleware(mockRequest as Request, mockResponse as Response, nextFunction);

      // Simulate an error
      const error = new Error('Integration test error');
      errorHandler(error, mockRequest as Request, mockResponse as Response, jest.fn());

      // Finish response
      (mockResponse as any).emit('finish');

      // Should capture the error in telemetry
      expect(mockBatcherAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          error_type: 'Error',
          error_message: 'Integration test error',
        })
      );
    });
  });
});
