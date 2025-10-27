import { Router } from 'express';
import performanceMonitor from '../utils/performance-monitor.js';

const router = Router();

// Performance monitoring endpoint
router.get('/performance', (req, res) => {
  const stats = performanceMonitor.getStats();
  res.json({
    status: 'success',
    data: stats,
    timestamp: new Date().toISOString()
  });
});

// Reset performance metrics
router.post('/performance/reset', (req, res) => {
  performanceMonitor.reset();
  res.json({
    status: 'success',
    message: 'Performance metrics reset',
    timestamp: new Date().toISOString()
  });
});

// Health check with performance info
router.get('/health', (req, res) => {
  const stats = performanceMonitor.getStats();
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    performance: stats ? {
      totalQueries: stats.totalQueries,
      averageLatency: stats.averageLatency,
      cacheHitRates: stats.cacheHitRates
    } : null
  });
});

export default router;


