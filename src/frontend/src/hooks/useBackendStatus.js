import { useState, useEffect, useRef, useCallback } from 'react';

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_DURATION_MS = 10 * 60 * 1000; // 10 minutes
const MAX_CONSECUTIVE_ERRORS = 3;

/**
 * Hook to track backend readiness with visibility-aware polling.
 * 
 * States:
 * - "idle": Not yet started polling
 * - "loading": Backend is starting up (models loading)
 * - "ready": Backend is ready to process requests
 * - "timeout": Polling exceeded 10 minutes without becoming ready
 * - "error": Network or connection errors
 * 
 * Behavior:
 * - Polls /api/status every 5 seconds when tab is visible
 * - Pauses polling when tab is hidden
 * - Resumes and checks status when tab becomes visible
 * - Stops polling when ready or after 10 minute timeout
 */
export function useBackendStatus(apiUrl, token, shouldStart = false) {
    const [status, setStatus] = useState('idle');
    const [isPolling, setIsPolling] = useState(false);

    const pollingIntervalRef = useRef(null);
    const pollStartTimeRef = useRef(null);
    const consecutiveErrorsRef = useRef(0);
    const wasReadyRef = useRef(false);

    const checkStatus = useCallback(async () => {
        try {
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${apiUrl}/api/status`, { headers });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            consecutiveErrorsRef.current = 0;

            if (data.status === 'ready') {
                setStatus('ready');
                wasReadyRef.current = true;
                return true; // Signal to stop polling
            } else {
                setStatus('loading');
                return false;
            }
        } catch (error) {
            console.error('Backend status check failed:', error);
            consecutiveErrorsRef.current++;

            if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
                setStatus('error');
                return true; // Signal to stop polling
            }

            // Keep trying on transient errors
            return false;
        }
    }, [apiUrl, token]);

    const stopPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        setIsPolling(false);
    }, []);

    const startPolling = useCallback(() => {
        if (pollingIntervalRef.current) return; // Already polling

        pollStartTimeRef.current = Date.now();
        consecutiveErrorsRef.current = 0;
        setIsPolling(true);

        // Immediate first check
        checkStatus().then(shouldStop => {
            if (shouldStop) {
                stopPolling();
                return;
            }

            // Start interval polling
            pollingIntervalRef.current = setInterval(async () => {
                // Check timeout
                const elapsed = Date.now() - pollStartTimeRef.current;
                if (elapsed >= MAX_POLL_DURATION_MS) {
                    setStatus('timeout');
                    stopPolling();
                    return;
                }

                const shouldStop = await checkStatus();
                if (shouldStop) {
                    stopPolling();
                }
            }, POLL_INTERVAL_MS);
        });
    }, [checkStatus, stopPolling]);

    const retryWarmup = useCallback(() => {
        setStatus('loading');
        consecutiveErrorsRef.current = 0;
        wasReadyRef.current = false;
        startPolling();
    }, [startPolling]);

    // Handle visibility changes
    useEffect(() => {
        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                // Tab became visible
                if (status === 'ready' || wasReadyRef.current) {
                    // Was ready before - do a single check to see if still ready
                    const isReady = await checkStatus();
                    if (!isReady && status !== 'error') {
                        // Backend went cold, restart polling
                        wasReadyRef.current = false;
                        startPolling();
                    }
                } else if (status === 'loading' && !pollingIntervalRef.current) {
                    // Was loading but polling stopped (due to visibility)
                    startPolling();
                }
            } else {
                // Tab became hidden - stop polling to save resources
                stopPolling();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [status, checkStatus, startPolling, stopPolling]);

    // Start polling when shouldStart becomes true
    useEffect(() => {
        if (shouldStart && status === 'idle') {
            setStatus('loading');
            startPolling();
        }
    }, [shouldStart, status, startPolling]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopPolling();
        };
    }, [stopPolling]);

    return {
        backendStatus: status,
        isPolling,
        retryWarmup,
    };
}

