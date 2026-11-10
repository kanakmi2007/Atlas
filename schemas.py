"""
Pydantic schemas and models for Atlas (SupplyChain360 AI) backend.
Supports flexible Nonilion webhook payloads, validation errors, and multi-modal responses.
"""

from typing import List, Optional, Any, Dict, Union
from pydantic import BaseModel, Field


class WebhookAttachment(BaseModel):
    """Attachment metadata returned to Nonilion or the client."""
    type: str = Field(..., description="Type of attachment: 'image' or 'file'")
    name: str = Field(..., description="File name of the attachment")
    url: str = Field(..., description="Direct access URL using BASE_URL")


class WebhookRequest(BaseModel):
    """
    Flexible payload receiver matching Nonilion virtual office schemas and standard chatbots.
    Accepts message, text, content, prompt, sender, room_id, and attachments.
    """
    message: Optional[str] = Field(None, description="Main text message")
    text: Optional[str] = Field(None, description="Alternative text field")
    content: Optional[str] = Field(None, description="Alternative content field")
    prompt: Optional[str] = Field(None, description="Prompt parameter")
    attachments: Optional[List[Union[Dict[str, Any], WebhookAttachment]]] = Field(
        default_factory=list, description="Array of file or image attachments"
    )
    file_url: Optional[str] = Field(None, description="Direct URL to a CSV or data file")
    sender: Optional[str] = Field(None, description="User or agent identifier in Nonilion")
    room_id: Optional[str] = Field(None, description="Virtual office room ID")

    def get_query(self) -> str:
        """Extract the effective query string from any provided text field."""
        for candidate in [self.message, self.text, self.content, self.prompt]:
            if candidate and candidate.strip():
                return candidate.strip()
        return ""

    def get_attached_csv_url(self) -> Optional[str]:
        """Check for CSV url in file_url or attachments."""
        if self.file_url and self.file_url.lower().endswith(".csv"):
            return self.file_url
        if self.attachments:
            for att in self.attachments:
                if isinstance(att, dict):
                    url = att.get("url") or att.get("file_url") or att.get("path") or ""
                    if url.lower().endswith(".csv"):
                        return url
                elif isinstance(att, WebhookAttachment):
                    if att.url.lower().endswith(".csv") or att.name.lower().endswith(".csv"):
                        return att.url
        return None


class NodeDiagnostic(BaseModel):
    """Diagnostic metric for one of the 4 supply chain nodes."""
    node: str = Field(..., description="Node name: Sourcing, Production, Logistics, Inventory")
    status: str = Field(..., description="Status badge e.g. CRITICAL, WARNING, BOTTLENECK, STABLE")
    metric: str = Field(..., description="Key diagnostic summary metric")
    financial_impact_usd: float = Field(..., description="Estimated dollar value at risk")


class WebhookResponse(BaseModel):
    """
    Unified multi-modal response returned to Nonilion and API clients.
    Mirrors reply, message, and text for seamless compatibility across integrations.
    """
    status: str = Field(default="success", description="Status code: 'success', 'warning', or 'error'")
    reply: str = Field(..., description="Rich Markdown response for chat UI")
    message: str = Field(..., description="Alias for reply")
    text: str = Field(..., description="Alias for reply")
    total_at_risk_usd: Optional[float] = Field(None, description="Aggregated dollar value at risk")
    diagnostics: Optional[List[NodeDiagnostic]] = Field(default_factory=list, description="Diagnostic cards")
    attachments: List[WebhookAttachment] = Field(default_factory=list, description="Generated artifacts")
    room_id: Optional[str] = Field(None, description="Echoed Nonilion room ID")


class ManifestValidationResult(BaseModel):
    """Validation response from schema checker."""
    valid: bool
    error: Optional[str] = None
    row_count: Optional[int] = 0
    columns: Optional[List[str]] = Field(default_factory=list)


class ServiceStatusResponse(BaseModel):
    """Health and status check response."""
    service: str
    status: str
    docs: str
    demo_ui: str
