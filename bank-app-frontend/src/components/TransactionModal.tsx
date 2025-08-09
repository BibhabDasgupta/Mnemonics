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
import { getOrSetTerminalId } from "@/utils/terminalId";
import { useToast } from "@/components/ui/use-toast";

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
    const { toast } = useToast();

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


    const handleTransaction = async () => {
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

            toast({
                title: "Success",
                description: `Transaction completed successfully. ${result.fraud_prediction ? 'Note: This transaction was flagged for review.' : ''}`,
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
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Send Money</DialogTitle>
                    <DialogDescription>
                        Enter the recipient's details to make a transfer. Your device's security state will be verified.
                    </DialogDescription>
                </DialogHeader>
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
                {error && <p className="text-sm text-center text-red-500 pb-2">{error}</p>}
                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                    <Button variant="banking" onClick={handleTransaction} disabled={isLoading || !recipient || !amount || !biometricHash}>
                        {isLoading ? "Sending..." : "Send Money"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};