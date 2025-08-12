import React, { useEffect, useRef, useCallback, createContext, PropsWithChildren } from 'react';
import { useAppContext } from "@/context/AppContext";

/**
 * Provides a namespace for all behavioral analytics components and types,
 * ensuring clean, organized, and non-colliding code.
 */
export namespace BehavioralAnalytics {

    // --- Type Definitions ---

    /**
     * The final, aggregated metrics payload sent to the backend.
     * The customer_unique_id is optional as it may not exist when queued.
     */
    export interface Payload {
        customer_unique_id?: string;
        flight_avg: number;
        traj_avg: number;
        typing_speed: number;
        correction_rate: number;
        clicks_per_minute: number;
    }

    /** The raw data collected internally, structured to support the Python script's formulas. */
    interface Data {
        keyPressTimestamps: number[];
        trajectoryDistances: number[];
        lastMousePosition: { x: number; y: number } | null;
        correctionKeys: number;
        clickCount: number;
        totalKeystrokes: number; // Track total keystrokes for better typing speed calculation
    }

    /** Configuration props for the BehavioralAnalytics.Provider component. */
    export interface ProviderProps {
        endpoint: string;
        intervalMs?: number;
        debug?: boolean;
    }

    const Context = createContext<null>(null);

    /**
     * A React Provider that captures behavioral biometrics. It queues data until a
     * customerId is available and then sends all queued data.
     */
    export const Provider = ({
                                 children,
                                 endpoint,
                                 intervalMs = 60000, // Defaulting to 60 seconds
                                 debug = false,
                             }: PropsWithChildren<ProviderProps>) => {
        const { customerId } = useAppContext();
        const metricsRef = useRef<Data>({
            keyPressTimestamps: [],
            trajectoryDistances: [],
            lastMousePosition: null,
            correctionKeys: 0,
            clickCount: 0,
            totalKeystrokes: 0,
        });
        const intervalStartRef = useRef<number>(Date.now());
        const pendingPayloadsRef = useRef<Payload[]>([]);

        const sendPayloadToServer = useCallback(async (payload: Payload) => {
            console.log('--- [Analytics] Sending Payload ---', payload);

            if (!debug) {
                try {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    
                    if (!response.ok) {
                        console.error('Server rejected behavioral analytics:', response.status, response.statusText);
                    } else {
                        console.log('✅ Behavioral analytics sent successfully');
                    }
                } catch (error) {
                    console.error('❌ Failed to send behavioral analytics:', error);
                }
            } else {
                console.log('🐛 Debug mode: Would send payload:', payload);
            }
        }, [endpoint, debug]);

        useEffect(() => {
            const processPendingPayloads = async () => {
                if (customerId && pendingPayloadsRef.current.length > 0) {
                    console.log(`[Analytics] Customer ID found. Processing ${pendingPayloadsRef.current.length} pending payloads.`);
                    const payloadsToSend = [...pendingPayloadsRef.current];
                    pendingPayloadsRef.current = [];

                    for (const payload of payloadsToSend) {
                        const completePayload = { ...payload, customer_unique_id: customerId };
                        await sendPayloadToServer(completePayload);
                    }
                    console.log("[Analytics] Finished processing pending payloads.");
                }
            };
            processPendingPayloads();
        }, [customerId, sendPayloadToServer]);

        const gatherAndProcessAnalytics = useCallback(async () => {
            const metrics = metricsRef.current;
            const endTime = Date.now();
            const durationSeconds = (endTime - intervalStartRef.current) / 1000;
            const durationMinutes = durationSeconds / 60;

            console.log(`[Analytics] Gathering data after ${durationSeconds.toFixed(2)}s`);
            console.log(`[Analytics] Raw metrics:`, {
                keystrokes: metrics.totalKeystrokes,
                trajectories: metrics.trajectoryDistances.length,
                clicks: metrics.clickCount,
                corrections: metrics.correctionKeys
            });

            // ❌ REMOVED: Early return that was preventing data collection
            // Always try to calculate metrics, even with minimal activity

            if (durationMinutes <= 0) {
                console.log("[Analytics] Invalid duration, skipping");
                intervalStartRef.current = Date.now();
                return;
            }

            // Calculate flight time average (time between keystrokes)
            let key_flight_avg_s = 0;
            if (metrics.keyPressTimestamps.length > 1) {
                const flightTimes = [];
                for (let i = 1; i < metrics.keyPressTimestamps.length; i++) {
                    const flightTime = (metrics.keyPressTimestamps[i] - metrics.keyPressTimestamps[i - 1]) / 1000;
                    if (flightTime > 0 && flightTime < 10) { // Ignore unrealistic flight times
                        flightTimes.push(flightTime);
                    }
                }
                if (flightTimes.length > 0) {
                    key_flight_avg_s = flightTimes.reduce((sum, time) => sum + time, 0) / flightTimes.length;
                }
            }

            // Calculate average trajectory distance
            let traj_avg = 0;
            if (metrics.trajectoryDistances.length > 0) {
                // Filter out very small movements (noise) and very large jumps (page transitions)
                const validTrajectories = metrics.trajectoryDistances.filter(dist => dist > 1 && dist < 1000);
                if (validTrajectories.length > 0) {
                    traj_avg = validTrajectories.reduce((sum, dist) => sum + dist, 0) / validTrajectories.length;
                }
            }

            // ✅ IMPROVED: Better typing speed calculation
            // Characters per minute (more meaningful than 1/flight_time)
            const typing_speed = metrics.totalKeystrokes / durationMinutes;
            
            // Corrections per minute
            const correction_rate = metrics.correctionKeys / durationMinutes;
            
            // Clicks per minute
            const clicks_per_minute = metrics.clickCount / durationMinutes;

            const payload: Payload = {
                flight_avg: key_flight_avg_s,
                traj_avg: traj_avg,
                typing_speed: typing_speed,
                correction_rate: correction_rate,
                clicks_per_minute: clicks_per_minute,
            };

            console.log(`[Analytics] Calculated payload:`, payload);

            // ✅ IMPROVED: Only use customerId from context (more reliable)
            if (customerId) {
                const completePayload = { ...payload, customer_unique_id: customerId };
                await sendPayloadToServer(completePayload);
            } else {
                console.log("[Analytics] No Customer ID. Queuing payload.");
                pendingPayloadsRef.current.push(payload);
            }

            // Reset metrics for next interval
            metricsRef.current = {
                keyPressTimestamps: [],
                trajectoryDistances: [],
                lastMousePosition: null,
                correctionKeys: 0,
                clickCount: 0,
                totalKeystrokes: 0,
            };
            intervalStartRef.current = Date.now();
        }, [customerId, sendPayloadToServer]);

        useEffect(() => {
            const handleKeyDown = (e: KeyboardEvent) => {
                const timestamp = Date.now();
                metricsRef.current.keyPressTimestamps.push(timestamp);
                metricsRef.current.totalKeystrokes += 1; // Track all keystrokes
                
                if (e.key === 'Backspace' || e.key === 'Delete') {
                    metricsRef.current.correctionKeys += 1;
                }
                
                // Optional: Log keystroke activity for debugging
                if (metricsRef.current.totalKeystrokes % 10 === 0) {
                    console.log(`[Analytics] Keystroke count: ${metricsRef.current.totalKeystrokes}`);
                }
            };

            const handleClick = (e: MouseEvent) => {
                metricsRef.current.clickCount += 1;
                console.log(`[Analytics] Click count: ${metricsRef.current.clickCount}`);
            };

            const handleMouseMove = (e: MouseEvent) => {
                const { clientX, clientY } = e;
                const lastPos = metricsRef.current.lastMousePosition;
                
                if (lastPos) {
                    const deltaX = clientX - lastPos.x;
                    const deltaY = clientY - lastPos.y;
                    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                    
                    // Only record meaningful movements (filter out tiny movements)
                    if (distance > 1) {
                        metricsRef.current.trajectoryDistances.push(distance);
                    }
                }
                
                metricsRef.current.lastMousePosition = { x: clientX, y: clientY };
            };

            console.log('[Analytics] Setting up event listeners');
            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('click', handleClick);
            document.addEventListener('mousemove', handleMouseMove);

            // ✅ FIXED: Proper variable declaration
            const intervalId = setInterval(gatherAndProcessAnalytics, intervalMs);

            return () => {
                console.log('[Analytics] Cleaning up event listeners');
                document.removeEventListener('keydown', handleKeyDown);
                document.removeEventListener('click', handleClick);
                document.removeEventListener('mousemove', handleMouseMove);
                clearInterval(intervalId);
            };
        }, [intervalMs, gatherAndProcessAnalytics]);

        return <Context.Provider value={null}>{children}</Context.Provider>;
    };
}