import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const ownerOnly = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || req.user.role !== 'owner') {
    res.status(403).json({ error: 'Access denied. Owner only.' });
    return;
  }
  next();
};

export const ownerOrTeamLeader = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || !['owner', 'team_leader'].includes(req.user.role)) {
    res.status(403).json({ error: 'Access denied. Owner or Team Leader only.' });
    return;
  }
  next();
};

export const ownerOrSales = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || !['owner', 'sales'].includes(req.user.role)) {
    res.status(403).json({ error: 'Access denied. Owner or Sales only.' });
    return;
  }
  next();
};

