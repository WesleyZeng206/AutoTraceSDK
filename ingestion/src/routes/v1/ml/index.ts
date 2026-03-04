import { Router } from 'express';

export const mlRouter = Router();

mlRouter.all('/*', (_req, res) => {
  res.status(501).json({
    error: 'Not Implemented yet',
  });
});
