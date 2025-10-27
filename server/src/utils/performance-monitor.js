/**
 * Performance Monitoring Utility for Villy RAG
 * Tracks latency, cache hit rates, and other performance metrics
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      totalQueries: 0,
      totalLatency: 0,
      embeddingLatency: 0,
      dbQueryLatency: 0,
      rerankingLatency: 0,
      llmLatency: 0,
      cacheHits: {
        embedding: 0,
        sqg: 0,
        crossEncoder: 0
      },
      cacheMisses: {
        embedding: 0,
        sqg: 0,
        crossEncoder: 0
      },
      earlyTerminations: 0,
      simpleQuerySkips: 0
    };
    
    this.enabled = process.env.CHAT_PERFORMANCE_LOGGING === 'true';
  }

  startTimer(label) {
    if (!this.enabled) return null;
    return {
      label,
      start: Date.now()
    };
  }

  endTimer(timer) {
    if (!this.enabled || !timer) return 0;
    const duration = Date.now() - timer.start;
    this.metrics[`${timer.label}Latency`] += duration;
    return duration;
  }

  recordCacheHit(type) {
    if (!this.enabled) return;
    this.metrics.cacheHits[type]++;
  }

  recordCacheMiss(type) {
    if (!this.enabled) return;
    this.metrics.cacheMisses[type]++;
  }

  recordEarlyTermination() {
    if (!this.enabled) return;
    this.metrics.earlyTerminations++;
  }

  recordSimpleQuerySkip() {
    if (!this.enabled) return;
    this.metrics.simpleQuerySkips++;
  }

  recordQuery(totalLatency) {
    if (!this.enabled) return;
    this.metrics.totalQueries++;
    this.metrics.totalLatency += totalLatency;
  }

  getStats() {
    if (!this.enabled) return null;
    
    const stats = {
      totalQueries: this.metrics.totalQueries,
      averageLatency: this.metrics.totalQueries > 0 
        ? Math.round(this.metrics.totalLatency / this.metrics.totalQueries) 
        : 0,
      averageEmbeddingLatency: this.metrics.totalQueries > 0 
        ? Math.round(this.metrics.embeddingLatency / this.metrics.totalQueries) 
        : 0,
      averageDbQueryLatency: this.metrics.totalQueries > 0 
        ? Math.round(this.metrics.dbQueryLatency / this.metrics.totalQueries) 
        : 0,
      averageRerankingLatency: this.metrics.totalQueries > 0 
        ? Math.round(this.metrics.rerankingLatency / this.metrics.totalQueries) 
        : 0,
      averageLlmLatency: this.metrics.totalQueries > 0 
        ? Math.round(this.metrics.llmLatency / this.metrics.totalQueries) 
        : 0,
      cacheHitRates: {
        embedding: this.getCacheHitRate('embedding'),
        sqg: this.getCacheHitRate('sqg'),
        crossEncoder: this.getCacheHitRate('crossEncoder')
      },
      optimizationStats: {
        earlyTerminations: this.metrics.earlyTerminations,
        simpleQuerySkips: this.metrics.simpleQuerySkips,
        earlyTerminationRate: this.metrics.totalQueries > 0 
          ? Math.round((this.metrics.earlyTerminations / this.metrics.totalQueries) * 100) 
          : 0,
        simpleQuerySkipRate: this.metrics.totalQueries > 0 
          ? Math.round((this.metrics.simpleQuerySkips / this.metrics.totalQueries) * 100) 
          : 0
      }
    };

    return stats;
  }

  getCacheHitRate(type) {
    const hits = this.metrics.cacheHits[type];
    const misses = this.metrics.cacheMisses[type];
    const total = hits + misses;
    return total > 0 ? Math.round((hits / total) * 100) : 0;
  }

  logStats() {
    if (!this.enabled) return;
    
    const stats = this.getStats();
    if (!stats) return;

    console.log('[performance] Stats:', JSON.stringify(stats, null, 2));
  }

  reset() {
    this.metrics = {
      totalQueries: 0,
      totalLatency: 0,
      embeddingLatency: 0,
      dbQueryLatency: 0,
      rerankingLatency: 0,
      llmLatency: 0,
      cacheHits: {
        embedding: 0,
        sqg: 0,
        crossEncoder: 0
      },
      cacheMisses: {
        embedding: 0,
        sqg: 0,
        crossEncoder: 0
      },
      earlyTerminations: 0,
      simpleQuerySkips: 0
    };
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
