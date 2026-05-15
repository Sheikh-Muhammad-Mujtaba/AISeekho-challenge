import httpx
from typing import Dict, Any, List, Optional
from core.config import settings
from pydantic import BaseModel

class LeadQuotationItem(BaseModel):
    item: str
    qty: int
    rate: float
    business_purpose: str
    list_of_modules: str

class CreateLeadInput(BaseModel):
    first_name: str
    mobile_no: str
    email_id: str
    docstatus: int = 1
    lead_quot_ct: List[LeadQuotationItem] = []
    simulation_mode: bool = True

async def create_erpnext_lead(input_data: CreateLeadInput) -> Dict[str, Any]:
    """
    Creates a lead in ERPNext. If simulation_mode is True, it returns a simulated response.
    """
    payload = input_data.dict(exclude={"simulation_mode"})
    
    if input_data.simulation_mode:
        return {
            "status": "success",
            "message": "Simulated lead creation",
            "data": {
                "name": "CRM-LEAD-2026-SIMULATED",
                **payload
            }
        }
        
    headers = {
        "Authorization": f"token {settings.ERPNEXT_API_TOKEN}",
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{settings.ERPNEXT_BASE_URL}/api/resource/Lead",
                json=payload,
                headers=headers,
                timeout=10.0
            )
            response.raise_for_status()
            return {"status": "success", "data": response.json().get("data", {})}
        except httpx.HTTPStatusError as e:
            return {"status": "error", "message": f"HTTP error occurred: {e}", "details": e.response.text}
        except Exception as e:
            return {"status": "error", "message": f"An error occurred: {str(e)}"}

async def get_chatbot_link(lead_id: str) -> Dict[str, Any]:
    """
    Fetches the chatbot link/quotation link for a given Lead ID.
    """
    headers = {
        "Authorization": f"token {settings.ERPNEXT_API_TOKEN}",
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{settings.ERPNEXT_BASE_URL}/api/method/education.education.chatbot_api.get_chatbot_link",
                params={"lead_id": lead_id},
                headers=headers,
                timeout=10.0
            )
            response.raise_for_status()
            return {"status": "success", "data": response.json().get("message", {})}
        except httpx.HTTPStatusError as e:
            return {"status": "error", "message": f"HTTP error occurred: {e}", "details": e.response.text}
        except Exception as e:
            return {"status": "error", "message": f"An error occurred: {str(e)}"}
