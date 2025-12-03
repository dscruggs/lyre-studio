import json
import os
from pathlib import Path

import torch
import torchaudio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse

from api import config
from api.state import get_state, OUTPUT_DIR
from api.schemas import TranslationResponse, StatusResponse
from voice_services import realtime_effects
from voice_services import translation
from voice_services import speech_synthesis
from voice_services import audio_handler


router = APIRouter(prefix="/api")


@router.get("/effects")
def get_effects():
    """Return available effects and their parameters."""
    registry = realtime_effects.get_effect_definitions()
    result = {}
    for name, cfg in registry.items():
        result[name] = {
            "params": cfg.get("params", {}),
        }
    return result


@router.get("/languages")
def get_languages():
    """Return supported languages (excluding English)."""
    return config.list_languages()


@router.post("/celebrity-voice", response_model=StatusResponse)
async def upload_celebrity_voice(file: UploadFile = File(...)):
    """Upload a reference voice sample for cloning."""
    output_path = OUTPUT_DIR / "celebrity_voice.wav"
    content = await file.read()
    with output_path.open("wb") as fh:
        fh.write(content)
    state = get_state()
    state.celebrity_voice_path = str(output_path)
    return StatusResponse(status="ok", path=str(output_path))


@router.delete("/celebrity-voice", response_model=StatusResponse)
def clear_celebrity_voice():
    """Clear the uploaded voice sample."""
    state = get_state()
    state.celebrity_voice_path = None
    return StatusResponse(status="ok")


@router.post("/apply-effects")
async def apply_effects_to_audio(
    audio: UploadFile = File(...),
    effects: str = Form("{}"),
):
    """Apply pedalboard effects to uploaded audio."""
    raw = await audio.read()
    tmp_path = audio_handler.save_upload_to_temp(raw)
    try:
        waveform, sr = torchaudio.load(tmp_path)
        try:
            effects_config = json.loads(effects or "{}")
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Invalid effects payload") from exc

        if effects_config:
            wav_np = waveform.numpy()
            wav_np = realtime_effects.apply_effects(wav_np, sr, effects_config)
            waveform = torch.from_numpy(wav_np)

        output_path = OUTPUT_DIR / "effected.wav"
        torchaudio.save(str(output_path), waveform, sr)
        return FileResponse(output_path, media_type="audio/wav")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@router.post("/translate", response_model=TranslationResponse)
async def translate_only(
    audio: UploadFile = File(...),
    translate_to: str = Form(...),
):
    """Translate audio to text in the target language."""
    translated_text = await translation.translate_audio(audio, translate_to)
    return TranslationResponse(translated_text=translated_text)


@router.post("/synthesize")
async def synthesize_only(
    text: str = Form(...),
    language: str = Form("English"),
    expressiveness: float = Form(0.5),
    similarity: float = Form(0.6),
):
    """Synthesize speech using the uploaded voice reference."""
    output_path: Path = speech_synthesis.synthesize_text(
        text=text,
        language=language,
        expressiveness=expressiveness,
        similarity=similarity,
    )
    return FileResponse(output_path, media_type="audio/wav")

