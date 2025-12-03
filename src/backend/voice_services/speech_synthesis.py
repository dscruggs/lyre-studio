from pathlib import Path

import torchaudio
from fastapi import HTTPException

from api import config
from api.state import get_state, OUTPUT_DIR


def synthesize_text(
    text: str,
    language: str,
    expressiveness: float,
    similarity: float,
) -> Path:
    app_state = get_state()
    if not app_state.celebrity_voice_path:
        raise HTTPException(status_code=400, detail="No voice reference uploaded")

    chatterbox = app_state.chatterbox
    if chatterbox is None:
        raise HTTPException(status_code=503, detail="Models are still loading. Try again shortly.")

    lang_code = config.get_chatterbox_code(language)
    wav = chatterbox.generate(
        text,
        audio_prompt_path=app_state.celebrity_voice_path,
        language_id=lang_code,
        exaggeration=expressiveness,
        cfg_weight=similarity,
    )

    output_path = OUTPUT_DIR / "synthesized.wav"
    torchaudio.save(str(output_path), wav, chatterbox.sr)
    return output_path

