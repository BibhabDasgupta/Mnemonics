// --- File: src/components/TransactionModal.tsx ---

import { useState } from "react";
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
    const { toast } = useToast();

    const handleTransaction = async () => {
        setIsLoading(true);
        setError("");

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

            // Single API call to create the transaction
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
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Transaction failed.");
            }

            const result = await response.json();

            toast({
                title: "Success",
                description: "Transaction completed successfully.",
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
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Send Money</DialogTitle>
                    <DialogDescription>
                        Enter the recipient's details to make a transfer. This action is final.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="recipient" className="text-right">
                            To
                        </Label>
                        <Input
                            id="recipient"
                            placeholder="Account Number"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            className="col-span-3"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="amount" className="text-right">
                            Amount
                        </Label>
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
                {error && <p className="text-sm text-center text-red-500">{error}</p>}
                <DialogFooter>
                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                    <Button variant="banking" onClick={handleTransaction} disabled={isLoading || !recipient || !amount}>
                        {isLoading ? "Sending..." : "Send Money"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};