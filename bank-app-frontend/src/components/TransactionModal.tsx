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
import { MapPin, Shield, AlertTriangle } from 'lucide-react';

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

    // Enhanced transaction handler with location validation
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

            // Enhanced success message with location info
            let successMessage = "Transaction completed successfully.";
            if (result.fraud_prediction) {
                successMessage += " Note: This transaction was flagged for review.";
            }
            if (locationResult?.is_suspicious) {
                successMessage += " Location verification was completed.";
            }

            toast({
                title: "Success",
                description: successMessage,
                variant: result.fraud_prediction ? 'destructive' : 'default',
            });

            onTransactionSuccess(result.new_balance);
            handleClose();

        } catch (err: any) {
            setError(err.message || "An unexpected error occurred.");
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
                        {/* Security indicator */}
                        <div className="flex items-center space-x-1">
                            <Shield className="w-4 h-4 text-green-600" />
                            {hasLocationPermission && (
                                <MapPin className="w-4 h-4 text-blue-600" />
                            )}
                        </div>
                    </DialogTitle>
                    <DialogDescription>
                        Enter the recipient's details to make a transfer. Your device's security state and location will be verified.
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

                {/* Security status display */}
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
                        {isLoading ? "Sending..." : "Send Money"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};