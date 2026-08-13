"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownerOrSalesOrTeamLeaderOrAccountManagerOrModeratorOrContentCreator = exports.ownerOrTeamLeaderOrContentCreator = exports.ownerOrTeamLeaderOrSalesOrContentCreator = exports.ownerOrTeamLeaderOrSales = exports.ownerOrSalesOrTeamLeaderOrAccountManager = exports.ownerOrSales = exports.ownerOrTeamLeaderOnly = exports.ownerOrTeamLeader = exports.ownerOnly = void 0;
const ownerOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'owner') {
        res.status(403).json({ error: 'Access denied. Owner only.' });
        return;
    }
    next();
};
exports.ownerOnly = ownerOnly;
const ownerOrTeamLeader = (req, res, next) => {
    if (!req.user || !['owner', 'team_leader', 'moderation', 'account_manager'].includes(req.user.role)) {
        res.status(403).json({ error: 'Access denied. Authorized roles only.' });
        return;
    }
    next();
};
exports.ownerOrTeamLeader = ownerOrTeamLeader;
const ownerOrTeamLeaderOnly = (req, res, next) => {
    if (!req.user || !['owner', 'team_leader'].includes(req.user.role)) {
        res.status(403).json({ error: 'Access denied. Owner or Team Leader only.' });
        return;
    }
    next();
};
exports.ownerOrTeamLeaderOnly = ownerOrTeamLeaderOnly;
const ownerOrSales = (req, res, next) => {
    if (!req.user || !['owner', 'sales'].includes(req.user.role)) {
        res.status(403).json({ error: 'Access denied. Owner or Sales only.' });
        return;
    }
    next();
};
exports.ownerOrSales = ownerOrSales;
const ownerOrSalesOrTeamLeaderOrAccountManager = (req, res, next) => {
    if (!req.user || !['owner', 'sales', 'team_leader', 'account_manager', 'moderation'].includes(req.user.role)) {
        res.status(403).json({ error: 'Access denied. Authorized roles only.' });
        return;
    }
    next();
};
exports.ownerOrSalesOrTeamLeaderOrAccountManager = ownerOrSalesOrTeamLeaderOrAccountManager;
const ownerOrTeamLeaderOrSales = (req, res, next) => {
    if (!req.user || !['owner', 'team_leader', 'sales', 'moderation', 'account_manager'].includes(req.user.role)) {
        res.status(403).json({ error: 'Access denied. Authorized roles only.' });
        return;
    }
    next();
};
exports.ownerOrTeamLeaderOrSales = ownerOrTeamLeaderOrSales;
const ownerOrTeamLeaderOrSalesOrContentCreator = (req, res, next) => {
    if (!req.user || !['owner', 'team_leader', 'sales', 'moderation', 'account_manager', 'content_creator'].includes(req.user.role)) {
        res.status(403).json({ error: 'Access denied. Authorized roles only.' });
        return;
    }
    next();
};
exports.ownerOrTeamLeaderOrSalesOrContentCreator = ownerOrTeamLeaderOrSalesOrContentCreator;
const ownerOrTeamLeaderOrContentCreator = (req, res, next) => {
    if (!req.user || !['owner', 'team_leader', 'moderation', 'account_manager', 'content_creator', 'content_creator_intern'].includes(req.user.role)) {
        res.status(403).json({ error: 'Access denied. Authorized roles only.' });
        return;
    }
    next();
};
exports.ownerOrTeamLeaderOrContentCreator = ownerOrTeamLeaderOrContentCreator;
const ownerOrSalesOrTeamLeaderOrAccountManagerOrModeratorOrContentCreator = (req, res, next) => {
    if (!req.user || req.user.role === 'client') {
        res.status(403).json({ error: 'Access denied. Authorized roles only.' });
        return;
    }
    next();
};
exports.ownerOrSalesOrTeamLeaderOrAccountManagerOrModeratorOrContentCreator = ownerOrSalesOrTeamLeaderOrAccountManagerOrModeratorOrContentCreator;
