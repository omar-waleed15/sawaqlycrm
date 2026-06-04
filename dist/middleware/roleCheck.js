"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownerOrSales = exports.ownerOrTeamLeader = exports.ownerOnly = void 0;
const ownerOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'owner') {
        res.status(403).json({ error: 'Access denied. Owner only.' });
        return;
    }
    next();
};
exports.ownerOnly = ownerOnly;
const ownerOrTeamLeader = (req, res, next) => {
    if (!req.user || !['owner', 'team_leader'].includes(req.user.role)) {
        res.status(403).json({ error: 'Access denied. Owner or Team Leader only.' });
        return;
    }
    next();
};
exports.ownerOrTeamLeader = ownerOrTeamLeader;
const ownerOrSales = (req, res, next) => {
    if (!req.user || !['owner', 'sales'].includes(req.user.role)) {
        res.status(403).json({ error: 'Access denied. Owner or Sales only.' });
        return;
    }
    next();
};
exports.ownerOrSales = ownerOrSales;
