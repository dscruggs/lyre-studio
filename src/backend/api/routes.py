import json
import logging
import os
import tempfile

import torch
import torchaudio
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse

from api import config
from api.state import get_state
from api.schemas import TranslationResponse, StatusResponse
from voice_services import realtime_effects
from voice_services import translation
from voice_services import speech_synthesis
from voice_services import audio_handler

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


def cleanup_file(path: str):
    """Remove a temp file if it exists."""
    if path and os.path.exists(path):
        os.unlink(path)


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


@router.post("/voice-reference", response_model=StatusResponse)
async def upload_voice_reference(file: UploadFile = File(...)):
    """Upload a reference voice sample for cloning."""
    state = get_state()
    
    # Clean up old temp file if exists
    if state.voice_reference_path and os.path.exists(state.voice_reference_path):
        os.unlink(state.voice_reference_path)
    
    # Save uploaded bytes to temp file (might be webm, ogg, wav, etc.)
    content = await file.read()
    tmp_input = tempfile.NamedTemporaryFile(delete=False, suffix=".webm")
    tmp_input.write(content)
    tmp_input.close()
    
    logger.info(f"Voice reference uploaded: {len(content)} bytes")
    
    # Convert to proper WAV format using torchaudio
    try:
        waveform, sr = torchaudio.load(tmp_input.name)
        logger.debug(f"Audio loaded: shape={waveform.shape}, sr={sr}")
        
        # Resample to 24kHz if needed (chatterbox expects this)
        if sr != 24000:
            waveform = torchaudio.transforms.Resample(sr, 24000)(waveform)
            logger.debug("Resampled to 24kHz")
        
        # Save as proper WAV
        tmp_wav = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        torchaudio.save(tmp_wav.name, waveform, 24000)
        tmp_wav.close()
        
        logger.info(f"Voice reference converted to WAV: {tmp_wav.name}")
        state.voice_reference_path = tmp_wav.name
    finally:
        # Clean up the input temp file
        os.unlink(tmp_input.name)
    
    return StatusResponse(status="ok", path=state.voice_reference_path)


@router.delete("/voice-reference", response_model=StatusResponse)
def clear_voice_reference():
    """Clear the uploaded voice sample."""
    state = get_state()
    if state.voice_reference_path and os.path.exists(state.voice_reference_path):
        os.unlink(state.voice_reference_path)
    state.voice_reference_path = None
    logger.info("Voice reference cleared")
    return StatusResponse(status="ok")


@router.post("/apply-effects")
async def apply_effects_to_audio(
    audio: UploadFile = File(...),
    effects: str = Form("{}"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Apply pedalboard effects to uploaded audio."""
    raw = await audio.read()
    tmp_input = audio_handler.save_upload_to_temp(raw)
    tmp_output = None
    
    try:
        waveform, sr = torchaudio.load(tmp_input)
        try:
            effects_config = json.loads(effects or "{}")
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Invalid effects payload") from exc

        if effects_config:
            wav_np = waveform.numpy()
            wav_np = realtime_effects.apply_effects(wav_np, sr, effects_config)
            waveform = torch.from_numpy(wav_np)

        tmp_output = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        torchaudio.save(tmp_output.name, waveform, sr)
        tmp_output.close()
        
        background_tasks.add_task(cleanup_file, tmp_output.name)
        return FileResponse(tmp_output.name, media_type="audio/wav")
    finally:
        cleanup_file(tmp_input)


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
    background_tasks: BackgroundTasks = BackgroundTasks(),
):
    """Synthesize speech using the uploaded voice reference."""
    output_path = speech_synthesis.synthesize_text(
        text=text,
        language=language,
        expressiveness=expressiveness,
        similarity=similarity,
    )
    background_tasks.add_task(cleanup_file, output_path)
    return FileResponse(output_path, media_type="audio/wav")
