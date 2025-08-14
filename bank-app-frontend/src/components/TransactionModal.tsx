// --- File: src/components/TransactionModal.tsx ---

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getOrSetTerminalId } from "@/utils/terminalId";
import { useToast } from "@/components/ui/use-toast";
import { useLocationContext } from '@/context/LocationContext';
import { useSecurityContext } from '@/context/SecurityContext';
import { SecurityService } from '@/services/securityService';
import { MapPin, Shield, AlertTriangle } from 'lucide-react';
import type { TransactionData } from '@/context/SecurityContext';

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onTransactionSuccess: (newBalance: number) => void;
}

export const TransactionModal = ({ isOpen, onClose, onTransactionSuccess }: TransactionModalProps) => {
    const [recipient, setRecipient] = useState("");
    const [amount, setAmount] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [biometricHash, setBiometricHash] = useState<string | null>(null);
    const [locationValidation, setLocationValidation] = useState<any>(null);
    const [showLocationWarning, setShowLocationWarning] = useState(false);
    
    const { toast } = useToast();
    
    // Location context integration
    const { validateCurrentLocation, hasLocationPermission, lastValidation } = useLocationContext();
    
    // Security context integration for fraud detection
    const { triggerTransactionAlert } = useSecurityContext();

    // Effect to fetch the biometric state when the modal opens
    useEffect(() => {
        if (isOpen) {
            const fetchBiometricState = async () => {
                try {
                    // Call the local biometric checker server
                    const response = await fetch("http://localhost:5050/check_state");
                    if (!response.ok) {
                        throw new Error("Biometric checker service not available or failed.");
                    }
                    const data = await response.json();
                    if (data.current_hash) {
                        setBiometricHash(data.current_hash);
                        console.log("Biometric state hash captured:", data.current_hash);
                    } else {
                         throw new Error("Could not retrieve biometric hash from checker.");
                    }
                } catch (err: any) {
                    console.error("Failed to fetch biometric state:", err);
                    setError("Could not verify device security. Please ensure the checker is running.");
                    toast({
                      variant: "destructive",
                      title: "Device Check Failed",
                      description: err.message || "Could not connect to the biometric checker.",
                    });
                    setBiometricHash(null);
                }
            };
            fetchBiometricState();
        }
    }, [isOpen, toast]);

    // Enhanced transaction handler with fraud detection integration
    const handleTransaction = async () => {
        // Location validation before transaction
        console.log('🌍 [TransactionModal] Validating location before transaction');
        const locationResult = await validateCurrentLocation();
        setLocationValidation(locationResult);
        
        if (locationResult?.is_suspicious && locationResult?.action === 'blocked') {
            toast({
                title: "Transaction Blocked",
                description: "Suspicious location activity detected. Please verify your identity.",
                variant: "destructive",
            });
            setError("Transaction blocked due to suspicious location activity.");
            return;
        }
        
        if (locationResult?.is_suspicious && locationResult?.action === 'warning') {
            // Show warning but allow transaction to continue
            setShowLocationWarning(true);
            toast({
                title: "Location Warning",
                description: locationResult.message,
                variant: "destructive",
            });
        }

        // Continue with existing transaction logic
        setIsLoading(true);
        setError("");

        if (!biometricHash) {
            setError("Cannot proceed without a valid device security check.");
            setIsLoading(false);
            return;
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            setError("Please enter a valid amount.");
            setIsLoading(false);
            return;
        }

        try {
            const terminalId = getOrSetTerminalId();
            const token = document.cookie.split('; ').find(row => row.startsWith('auth_token='))?.split('=')[1];

            if (!token) {
                throw new Error("Authentication token not found. Please log in again.");
            }

            console.log('🔒 [TransactionModal] Initiating transaction with fraud detection');
            
            const response = await fetch("http://localhost:8000/api/v1/transactions/create", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    recipient_account_number: recipient,
                    amount: parsedAmount,
                    terminal_id: terminalId,
                    biometric_hash: biometricHash, // Send the captured hash
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Transaction failed.");
            }

            const result = await response.json();
            console.log('🔒 [TransactionModal] Transaction response:', result);

            // ✅ ENHANCED FRAUD DETECTION INTEGRATION
            if (result.fraud_prediction && result.blocked) {
                console.log('🚨 [TransactionModal] Fraud detected - triggering security alert');
                
                // Prepare transaction data for retry
                const transactionData: TransactionData = {
                    recipient_account_number: recipient,
                    amount: parsedAmount,
                    terminal_id: terminalId,
                    biometric_hash: biometricHash
                };
                
                console.log('💳 [TransactionModal] Prepared transaction data for retry:', {
                    recipient: transactionData.recipient_account_number,
                    amount: transactionData.amount,
                    terminal: transactionData.terminal_id,
                    hasBiometricHash: !!transactionData.biometric_hash
                });
                
                // Transaction was blocked due to fraud detection - pass transaction data
                const securityAlert = SecurityService.createTransactionAlert(result.fraud_details);
                triggerTransactionAlert(securityAlert, transactionData); // Pass transaction data
                
                // Close modal before showing security alert
                handleClose();
                
                // Show immediate feedback
                toast({
                    title: "Transaction Blocked",
                    description: "Suspicious activity detected. You will be redirected to security verification where you can retry after verification.",
                    variant: "destructive",
                });
                
                return; // Exit early - don't continue with success flow
            }

            // ✅ SUCCESSFUL TRANSACTION HANDLING
            if (result.status === "Transaction successful") {
                onTransactionSuccess(result.new_balance);
                handleClose();
                
                // Enhanced success message with location info
                let successMessage = "Transaction completed successfully!";
                if (locationResult?.is_suspicious) {
                    successMessage += " Location verification was completed.";
                }
                
                // Show success message
                toast({
                    title: "Success",
                    description: successMessage,
                    variant: "default",
                });
                
                // ✅ FRAUD PROBABILITY WARNING (for high-risk but not blocked transactions)
                if (result.fraud_probability && result.fraud_probability > 0.3) {
                    toast({
                        title: "Security Notice",
                        description: `Transaction completed but flagged for review (${(result.fraud_probability * 100).toFixed(1)}% risk score)`,
                        variant: "destructive",
                    });
                }
            } else {
                throw new Error(result.message || 'Transaction failed');
            }

        } catch (err: any) {
            console.error('❌ [TransactionModal] Transaction error:', err);
            
            // Enhanced error handling
            const errorMessage = err.message || "An unexpected error occurred.";
            setError(errorMessage);
            
            toast({
                title: "Transaction Failed",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => {
        setRecipient("");
        setAmount("");
        setError("");
        setBiometricHash(null); // Reset hash on close
        setLocationValidation(null); // Reset location validation
        setShowLocationWarning(false); // Reset location warning
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                        <span>Send Money</span>
                        {/* Enhanced security indicator */}
                        <div className="flex items-center space-x-1">
                            <Shield className="w-4 h-4 text-green-600" />
                            {hasLocationPermission && (
                                <MapPin className="w-4 h-4 text-blue-600" />
                            )}
                            <Badge variant="outline" className="text-xs">
                                AI Protected
                            </Badge>
                        </div>
                    </DialogTitle>
                    <DialogDescription>
                        Enter the recipient's details to make a transfer. Your device's security state, location, and transaction patterns will be verified using AI fraud detection.
                    </DialogDescription>
                </DialogHeader>

                {/* Location warning alert */}
                {showLocationWarning && locationValidation && (
                    <Alert className="border-amber-200 bg-amber-50">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-amber-800">
                            <strong>Location Notice:</strong> {locationValidation.message}
                            {locationValidation.distance_km && (
                                <span className="block text-sm mt-1">
                                    Distance from usual location: {locationValidation.distance_km.toFixed(1)}km
                                </span>
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Enhanced security status display */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Security Status:</span>
                    <div className="flex items-center space-x-2">
                        <Badge variant={biometricHash ? "secondary" : "destructive"} className="text-xs">
                            {biometricHash ? "Device Verified" : "Pending"}
                        </Badge>
                        {hasLocationPermission && (
                            <Badge 
                                variant={
                                    locationValidation?.is_suspicious ? "destructive" : 
                                    locationValidation ? "secondary" : "outline"
                                } 
                                className="text-xs"
                            >
                                {locationValidation?.is_suspicious ? "Location Alert" :
                                 locationValidation ? "Location Verified" : "Location Check"}
                            </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                            Fraud AI
                        </Badge>
                    </div>
                </div>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="recipient" className="text-right">To</Label>
                        <Input
                            id="recipient"
                            placeholder="Account Number"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="amount" className="text-right">Amount</Label>
                        <Input
                            id="amount"
                            type="number"
                            placeholder="₹0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                </div>

                {/* Enhanced location details */}
                {locationValidation && locationValidation.location && (
                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center space-x-2 mb-2">
                            <MapPin className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-900">Transaction Location</span>
                        </div>
                        <div className="text-xs text-blue-700 space-y-1">
                            <div>Location: {locationValidation.location.city || 'Unknown'}, {locationValidation.location.country || 'Unknown'}</div>
                            <div>Source: {locationValidation.location.source?.toUpperCase() || 'Unknown'}</div>
                            {locationValidation.distance_km !== undefined && (
                                <div>Distance from usual: {locationValidation.distance_km.toFixed(1)}km</div>
                            )}
                        </div>
                    </div>
                )}

                {/* AI Fraud Protection Notice */}
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-2 mb-1">
                        <Shield className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-900">AI Fraud Protection</span>
                    </div>
                    <div className="text-xs text-green-700">
                        This transaction will be analyzed by our machine learning fraud detection system in real-time.
                    </div>
                </div>

                {error && <p className="text-sm text-center text-red-500 pb-2">{error}</p>}
                
                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                    <Button 
                        variant="banking" 
                        onClick={handleTransaction} 
                        disabled={
                            isLoading || 
                            !recipient || 
                            !amount || 
                            !biometricHash ||
                            (locationValidation?.is_suspicious && locationValidation?.action === 'blocked')
                        }
                    >
                        {isLoading ? "Analyzing & Sending..." : "Send Money"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};