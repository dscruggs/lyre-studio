import logging
import tempfile
import time

import torchaudio
from fastapi import HTTPException

from api import config
from api.state import get_state

logger = logging.getLogger(__name__)


def synthesize_text(
    text: str,
    language: str,
    expressiveness: float,
    similarity: float,
) -> str:
    app_state = get_state()
    if not app_state.voice_reference_path:
        raise HTTPException(status_code=400, detail="No voice reference uploaded")

    chatterbox = app_state.chatterbox
    if chatterbox is None:
        raise HTTPException(status_code=503, detail="Models are still loading. Try again shortly.")

    lang_code = config.get_chatterbox_code(language)
    
    logger.info(f"Synthesis starting: {len(text)} chars, lang={lang_code}")
    
    t0 = time.time()
    wav = chatterbox.generate(
        text,
        audio_prompt_path=app_state.voice_reference_path,
        language_id=lang_code,
        exaggeration=expressiveness,
        cfg_weight=similarity,
    )
    t1 = time.time()
    logger.info(f"Synthesis generation took {t1 - t0:.1f}s")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    torchaudio.save(tmp.name, wav, chatterbox.sr)
    tmp.close()
    
    logger.info(f"Synthesis complete, saved to {tmp.name}")
    return tmp.name
