// --- File: src/providers/BehavioralAnalyticsProvider.tsx ---
import React, { useEffect, useRef, useCallback, createContext, PropsWithChildren } from 'react';
import { useAppContext } from "@/context/AppContext";
import { useSecurityContext } from "@/context/SecurityContext";
import { SecurityService } from "@/services/securityService";

export namespace BehavioralAnalytics {
    export interface Payload {
        customer_unique_id: string;  
        flight_avg: number;
        traj_avg: number;
        typing_speed: number;
        correction_rate: number;
        clicks_per_minute: number;
    }

    interface IncompletePayload {
        flight_avg: number;
        traj_avg: number;
        typing_speed: number;
        correction_rate: number;
        clicks_per_minute: number;
    }

    interface Data {
        keyPressTimestamps: number[];
        trajectoryDistances: number[];
        lastMousePosition: { x: number; y: number } | null;
        correctionKeys: number;
        clickCount: number;
        totalKeystrokes: number;
    }

    export interface ProviderProps {
        endpoint: string;
        intervalMs?: number;
        debug?: boolean;
    }

    const Context = createContext<null>(null);

    // UUID validation utility
    const isValidUUID = (uuid: string): boolean => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    };

    // Payload validation utility
    const validatePayload = (payload: Payload): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];

        // Validate customer_unique_id
        if (!payload.customer_unique_id || !isValidUUID(payload.customer_unique_id)) {
            errors.push('Invalid or missing customer_unique_id (must be valid UUID)');
        }

        // Validate numeric ranges (aligned with backend expectations)
        if (payload.flight_avg < 0 || payload.flight_avg > 10) {
            errors.push('flight_avg must be between 0 and 10 seconds');
        }
        
        if (payload.traj_avg < 0 || payload.traj_avg > 1000) {
            errors.push('traj_avg must be between 0 and 1000 pixels');
        }
        
        if (payload.typing_speed < 0 || payload.typing_speed > 500) {
            errors.push('typing_speed must be between 0 and 500 chars/minute');
        }
        
        if (payload.correction_rate < 0 || payload.correction_rate > 100) {
            errors.push('correction_rate must be between 0 and 100 corrections/minute');
        }
        
        if (payload.clicks_per_minute < 0 || payload.clicks_per_minute > 1000) {
            errors.push('clicks_per_minute must be between 0 and 1000 clicks/minute');
        }

        return { valid: errors.length === 0, errors };
    };

    export const Provider = ({
        children,
        endpoint,
        intervalMs = 30000,
        debug = false,
    }: PropsWithChildren<ProviderProps>) => {
        const { customerId } = useAppContext();
        const { setSecurityAlert, isSecurityBlocked } = useSecurityContext();
        
        const metricsRef = useRef<Data>({
            keyPressTimestamps: [],
            trajectoryDistances: [],
            lastMousePosition: null,
            correctionKeys: 0,
            clickCount: 0,
            totalKeystrokes: 0,
        });
        const intervalStartRef = useRef<number>(Date.now());
        const pendingPayloadsRef = useRef<IncompletePayload[]>([]);

        const sendPayloadToServer = useCallback(async (payload: Payload) => {
            console.log('--- [Analytics] Sending Payload ---', payload);

            // Validate payload before sending
            const validation = validatePayload(payload);
            if (!validation.valid) {
                console.error('❌ Invalid payload:', validation.errors);
                return;
            }

            if (!debug) {
                try {
                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });
                    
                    if (!response.ok) {
                        console.error('❌ Server rejected behavioral analytics:', response.status, response.statusText);
                        // Log response body for debugging
                        const errorText = await response.text();
                        console.error('Server error details:', errorText);
                    } else {
                        console.log('✅ Behavioral analytics sent successfully');
                        
                        // 🤖 PERFORM ML ANOMALY DETECTION AFTER SUCCESSFUL SUBMISSION
                        await performMLVerification(payload);
                    }
                } catch (error) {
                    console.error('❌ Failed to send behavioral analytics:', error);
                }
            } else {
                console.log('🛠 Debug mode: Would send payload:', payload);
                // In debug mode, still perform ML verification for testing
                await performMLVerification(payload);
            }
        }, [endpoint, debug]);

        const performMLVerification = useCallback(async (payload: Payload) => {
            if (isSecurityBlocked) return;

            console.log('🤖 [ML Security] Performing anomaly detection...');
            
            try {
                const mlResult = await SecurityService.verifyBehavior({
                    customer_unique_id: payload.customer_unique_id,
                    flight_avg: payload.flight_avg,
                    traj_avg: payload.traj_avg,
                    typing_speed: payload.typing_speed,
                    correction_rate: payload.correction_rate,
                    clicks_per_minute: payload.clicks_per_minute,
                });

                console.log('🤖 [ML Security] Result:', mlResult);

                if (mlResult.success && mlResult.is_anomaly) {
                    console.log('🚨 [ML Security] ANOMALY DETECTED!');
                    console.log(`   Confidence: ${mlResult.confidence}%`);
                    console.log(`   Decision Score: ${mlResult.decision_score}`);
                    
                    // Create and set security alert
                    const alert = SecurityService.createSecurityAlert(mlResult, payload);
                    setSecurityAlert(alert);
                    
                    // Store alert in session for persistence across page reloads
                    sessionStorage.setItem('security_alert', JSON.stringify(alert));
                    
                } else if (mlResult.success) {
                    console.log('✅ [ML Security] Behavior verified as normal');
                    console.log(`   Confidence: ${mlResult.confidence}%`);
                } else {
                    console.log('⚠️ [ML Security] Verification failed:', mlResult.message);
                }
                
            } catch (error) {
                console.error('❌ [ML Security] Verification error:', error);
            }
        }, [setSecurityAlert, isSecurityBlocked]);

        useEffect(() => {
            const processPendingPayloads = async () => {
                if (customerId && isValidUUID(customerId) && pendingPayloadsRef.current.length > 0) {
                    console.log(`[Analytics] Customer ID found. Processing ${pendingPayloadsRef.current.length} pending payloads.`);
                    const payloadsToSend = [...pendingPayloadsRef.current];
                    pendingPayloadsRef.current = [];

                    for (const incompletePayload of payloadsToSend) {
                        const completePayload: Payload = { 
                            ...incompletePayload, 
                            customer_unique_id: customerId 
                        };
                        await sendPayloadToServer(completePayload);
                    }
                    console.log("[Analytics] Finished processing pending payloads.");
                }
            };
            processPendingPayloads();
        }, [customerId, sendPayloadToServer]);

        const gatherAndProcessAnalytics = useCallback(async () => {
            // Don't collect data if security is blocked
            if (isSecurityBlocked) {
                console.log('[Analytics] Security blocked - skipping data collection');
                return;
            }

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

            // Ensure minimum duration to avoid division by zero and invalid data
            if (durationMinutes <= 0.1) { // At least 6 seconds
                console.log("[Analytics] Duration too short, skipping");
                intervalStartRef.current = Date.now();
                return;
            }

            // Calculate flight time average with better filtering
            let key_flight_avg_s = 0;
            if (metrics.keyPressTimestamps.length > 1) {
                const flightTimes = [];
                for (let i = 1; i < metrics.keyPressTimestamps.length; i++) {
                    const flightTime = (metrics.keyPressTimestamps[i] - metrics.keyPressTimestamps[i - 1]) / 1000;
                    // More realistic bounds for flight time
                    if (flightTime > 0.01 && flightTime < 5) {
                        flightTimes.push(flightTime);
                    }
                }
                if (flightTimes.length > 0) {
                    key_flight_avg_s = flightTimes.reduce((sum, time) => sum + time, 0) / flightTimes.length;
                }
            }

            // Calculate average trajectory distance with smoothing
            let traj_avg = 0;
            if (metrics.trajectoryDistances.length > 0) {
                // Filter out micro-movements and extreme values
                const validTrajectories = metrics.trajectoryDistances.filter(dist => dist >= 2 && dist <= 500);
                if (validTrajectories.length > 0) {
                    traj_avg = validTrajectories.reduce((sum, dist) => sum + dist, 0) / validTrajectories.length;
                }
            }

            const typing_speed = metrics.totalKeystrokes / durationMinutes;
            const correction_rate = metrics.correctionKeys / durationMinutes;
            const clicks_per_minute = metrics.clickCount / durationMinutes;

            const incompletePayload: IncompletePayload = {
                flight_avg: Number(key_flight_avg_s.toFixed(4)),
                traj_avg: Number(traj_avg.toFixed(2)),
                typing_speed: Number(typing_speed.toFixed(2)),
                correction_rate: Number(correction_rate.toFixed(2)),
                clicks_per_minute: Number(clicks_per_minute.toFixed(2)),
            };

            console.log(`[Analytics] Calculated payload:`, incompletePayload);

            if (customerId && isValidUUID(customerId)) {
                const completePayload: Payload = { 
                    ...incompletePayload, 
                    customer_unique_id: customerId 
                };
                await sendPayloadToServer(completePayload);
            } else {
                console.log("[Analytics] No valid Customer ID. Queuing payload.");
                pendingPayloadsRef.current.push(incompletePayload);
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
        }, [customerId, sendPayloadToServer, isSecurityBlocked]);

        useEffect(() => {
            const handleKeyDown = (e: KeyboardEvent) => {
                if (isSecurityBlocked) return;
                
                // Filter out non-character keys for more accurate metrics
                if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') {
                    const timestamp = Date.now();
                    metricsRef.current.keyPressTimestamps.push(timestamp);
                    metricsRef.current.totalKeystrokes += 1;
                    
                    // Only count actual correction keys
                    if (e.key === 'Backspace' || e.key === 'Delete') {
                        metricsRef.current.correctionKeys += 1;
                    }
                    
                    if (metricsRef.current.totalKeystrokes % 10 === 0) {
                        console.log(`[Analytics] Keystroke count: ${metricsRef.current.totalKeystrokes}`);
                    }
                }
            };

            const handleClick = (e: MouseEvent) => {
                if (isSecurityBlocked) return;
                
                metricsRef.current.clickCount += 1;
                if (metricsRef.current.clickCount % 5 === 0) {
                    console.log(`[Analytics] Click count: ${metricsRef.current.clickCount}`);
                }
            };

            const handleMouseMove = (e: MouseEvent) => {
                if (isSecurityBlocked) return;
                
                const { clientX, clientY } = e;
                const lastPos = metricsRef.current.lastMousePosition;
                
                if (lastPos) {
                    const deltaX = clientX - lastPos.x;
                    const deltaY = clientY - lastPos.y;
                    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                    
                    // Filter out micro-movements
                    if (distance > 2) {
                        metricsRef.current.trajectoryDistances.push(distance);
                    }
                }
                
                metricsRef.current.lastMousePosition = { x: clientX, y: clientY };
            };

            console.log('[Analytics] Setting up event listeners');
            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('click', handleClick);
            document.addEventListener('mousemove', handleMouseMove);

            const intervalId = setInterval(gatherAndProcessAnalytics, intervalMs);

            return () => {
                console.log('[Analytics] Cleaning up event listeners');
                document.removeEventListener('keydown', handleKeyDown);
                document.removeEventListener('click', handleClick);
                document.removeEventListener('mousemove', handleMouseMove);
                clearInterval(intervalId);
            };
        }, [intervalMs, gatherAndProcessAnalytics, isSecurityBlocked]);

        return <Context.Provider value={null}>{children}</Context.Provider>;
    };
}