from pydantic import BaseModel


class TranslationResponse(BaseModel):
    translated_text: str


class StatusResponse(BaseModel):
    status: str
    path: str | None = None

