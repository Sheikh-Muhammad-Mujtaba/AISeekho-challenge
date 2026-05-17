from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from mcp_tools.erpnext import analyze_crm_data, AnalyzeCrmInput
import json

router = APIRouter()

@router.get("/leads")
async def get_categorized_leads(db: AsyncSession = Depends(get_db)):
    """
    Fetch all leads from ERPNext and categorize them by status.
    Returns a structured streamable object for the frontend CRM view.
    """
    try:
        # Fetch up to 100 recent leads for the CRM view
        input_data = AnalyzeCrmInput(
            doctype="Lead",
            fields=["name", "lead_name", "status", "source", "creation", "email_id", "mobile_no"],
            limit=100,
            order_by="creation desc"
        )
        
        response = await analyze_crm_data(input_data)
        if response.get("status") == "error":
            raise HTTPException(status_code=500, detail=response.get("message"))
            
        records = response.get("data", [])
        
        # Categorize leads
        categorized = {
            "Open": [],
            "Replied": [],
            "Opportunity": [],
            "Converted": [],
            "Do Not Contact": []
        }
        
        for record in records:
            status = record.get("status", "Open")
            if status in categorized:
                categorized[status].append(record)
            else:
                categorized["Open"].append(record) # Fallback
                
        return {
            "status": "success",
            "total_leads": len(records),
            "categorized_leads": categorized,
            "raw_leads": records
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
