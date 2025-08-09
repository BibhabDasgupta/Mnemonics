from pydantic import BaseModel, Field

class TransactionCreateRequest(BaseModel):
    recipient_account_number: str = Field(..., description="The account number of the recipient.")
    amount: float = Field(..., gt=0, description="The amount to transfer.")
    terminal_id: str = Field(..., description="A unique identifier for the client device/terminal.")