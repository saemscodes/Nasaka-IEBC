/**
 * Nasaka IEBC — Observability Utility
 * Provides structured JSON logging compatible with Vercel Log Drain and GCP/Axiom.
 */

export interface LogEvent {
    event: 'api_request' | 'api_error' | 'cache_event' | 'system_event';
    path: string;
    method?: string;
    status?: number;
    duration_ms?: number;
    tier?: string;
    cache?: 'HIT' | 'MISS' | 'BYPASS';
    user_id?: string;
    key_hash_prefix?: string;
    error?: string;
    meta?: Record<string, any>;
}

export function logEvent(data: LogEvent) {
    const timestamp = new Date().toISOString();
    const logBody = {
        ...data,
        timestamp,
        platform: 'nasaka-iebc-api',
        version: '1.0.0'
    };

    // In Vercel Edge Functions, console.log is captured as structured logs
    console.log(JSON.stringify(logBody));
}

/**
 * Performance wrapper for logging
 */
export function createLogger(req: Request) {
    const startTime = Date.now();
    const url = new URL(req.url);

    return {
        success: (status: number, tier?: string, cache?: 'HIT' | 'MISS' | 'BYPASS', meta?: Record<string, any>) => {
            logEvent({
                event: 'api_request',
                path: url.pathname,
                method: req.method,
                status,
                tier,
                cache,
                duration_ms: Date.now() - startTime,
                meta
            });
        },
        error: (status: number, message: string, tier?: string, meta?: Record<string, any>) => {
            logEvent({
                event: 'api_error',
                path: url.pathname,
                method: req.method,
                status,
                tier,
                error: message,
                duration_ms: Date.now() - startTime,
                meta
            });
        }
    };
}
