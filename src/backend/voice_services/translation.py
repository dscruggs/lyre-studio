import logging
import os
import time

from fastapi import HTTPException, UploadFile
import torch

from api import config
from api.state import get_state, DEVICE
from voice_services.audio_handler import save_upload_to_temp, load_audio

logger = logging.getLogger(__name__)


async def translate_audio(upload: UploadFile, target_language: str) -> str:
    languages = config.get_language_map()
    if target_language not in languages:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {target_language}")

    seamless_code = config.get_seamless_code(target_language)

    raw_bytes = await upload.read()
    tmp_path = save_upload_to_temp(raw_bytes)

    try:
        logger.info(f"Translation starting: target={target_language} ({seamless_code})")
        t0 = time.time()
        
        audio_array, sr = load_audio(tmp_path)
        logger.debug(f"Audio loaded: {len(audio_array)} samples, sr={sr}")
        
        app_state = get_state()
        processor = app_state.seamless_processor
        model = app_state.seamless_model
        if not processor or not model:
            raise HTTPException(status_code=503, detail="Models are still loading. Try again shortly.")

        inputs = processor(audio=audio_array, sampling_rate=sr, return_tensors="pt").to(DEVICE)
        
        t1 = time.time()
        with torch.no_grad():
            output = model.generate(**inputs, tgt_lang=seamless_code)
        t2 = time.time()

        translated_text = processor.decode(output[0].squeeze().tolist(), skip_special_tokens=True)
        
        logger.info(f"Translation complete in {t2 - t0:.1f}s (inference: {t2 - t1:.1f}s)")
        logger.debug(f"Translation result: {translated_text[:100]}...")
        
        return translated_text
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
