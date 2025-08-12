// --- File: src/providers/BehavioralAnalyticsProvider.tsx ---
import React, { useEffect, useRef, useCallback, createContext, PropsWithChildren } from 'react';
import { useAppContext } from "@/context/AppContext";
import { useSecurityContext } from "@/context/SecurityContext";
import { SecurityService } from "@/services/securityService";

export namespace BehavioralAnalytics {
    export interface Payload {
        customer_unique_id?: string;
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

    export const Provider = ({
        children,
        endpoint,
        intervalMs = 60000,
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
                        console.error('❌ Server rejected behavioral analytics:', response.status, response.statusText);
                    } else {
                        console.log('✅ Behavioral analytics sent successfully');
                        
                        // 🤖 PERFORM ML ANOMALY DETECTION AFTER SUCCESSFUL SUBMISSION
                        if (payload.customer_unique_id) {
                            await performMLVerification(payload);
                        }
                    }
                } catch (error) {
                    console.error('❌ Failed to send behavioral analytics:', error);
                }
            } else {
                console.log('🐛 Debug mode: Would send payload:', payload);
                // In debug mode, still perform ML verification for testing
                if (payload.customer_unique_id) {
                    await performMLVerification(payload);
                }
            }
        }, [endpoint, debug]);

        const performMLVerification = useCallback(async (payload: Payload) => {
            if (!payload.customer_unique_id || isSecurityBlocked) return;

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

            if (durationMinutes <= 0) {
                console.log("[Analytics] Invalid duration, skipping");
                intervalStartRef.current = Date.now();
                return;
            }

            // Calculate flight time average
            let key_flight_avg_s = 0;
            if (metrics.keyPressTimestamps.length > 1) {
                const flightTimes = [];
                for (let i = 1; i < metrics.keyPressTimestamps.length; i++) {
                    const flightTime = (metrics.keyPressTimestamps[i] - metrics.keyPressTimestamps[i - 1]) / 1000;
                    if (flightTime > 0 && flightTime < 10) {
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
                const validTrajectories = metrics.trajectoryDistances.filter(dist => dist > 1 && dist < 1000);
                if (validTrajectories.length > 0) {
                    traj_avg = validTrajectories.reduce((sum, dist) => sum + dist, 0) / validTrajectories.length;
                }
            }

            const typing_speed = metrics.totalKeystrokes / durationMinutes;
            const correction_rate = metrics.correctionKeys / durationMinutes;
            const clicks_per_minute = metrics.clickCount / durationMinutes;

            const payload: Payload = {
                flight_avg: key_flight_avg_s,
                traj_avg: traj_avg,
                typing_speed: typing_speed,
                correction_rate: correction_rate,
                clicks_per_minute: clicks_per_minute,
            };

            console.log(`[Analytics] Calculated payload:`, payload);

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
        }, [customerId, sendPayloadToServer, isSecurityBlocked]);

        useEffect(() => {
            const handleKeyDown = (e: KeyboardEvent) => {
                if (isSecurityBlocked) return;
                
                const timestamp = Date.now();
                metricsRef.current.keyPressTimestamps.push(timestamp);
                metricsRef.current.totalKeystrokes += 1;
                
                if (e.key === 'Backspace' || e.key === 'Delete') {
                    metricsRef.current.correctionKeys += 1;
                }
                
                if (metricsRef.current.totalKeystrokes % 10 === 0) {
                    console.log(`[Analytics] Keystroke count: ${metricsRef.current.totalKeystrokes}`);
                }
            };

            const handleClick = (e: MouseEvent) => {
                if (isSecurityBlocked) return;
                
                metricsRef.current.clickCount += 1;
                console.log(`[Analytics] Click count: ${metricsRef.current.clickCount}`);
            };

            const handleMouseMove = (e: MouseEvent) => {
                if (isSecurityBlocked) return;
                
                const { clientX, clientY } = e;
                const lastPos = metricsRef.current.lastMousePosition;
                
                if (lastPos) {
                    const deltaX = clientX - lastPos.x;
                    const deltaY = clientY - lastPos.y;
                    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                    
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