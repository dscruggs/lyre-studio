from typing import Optional

import torch
from transformers import AutoProcessor, SeamlessM4Tv2ForSpeechToText
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

from api.config import get_outputs_dir


def _resolve_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


DEVICE = _resolve_device()
OUTPUT_DIR = get_outputs_dir()


_original_torch_load = torch.load


def _patched_torch_load(*args, **kwargs):
    if "map_location" not in kwargs:
        kwargs["map_location"] = DEVICE
    return _original_torch_load(*args, **kwargs)


torch.load = _patched_torch_load


class AppState:
    def __init__(self):
        self.celebrity_voice_path: Optional[str] = None
        self.seamless_model: Optional[SeamlessM4Tv2ForSpeechToText] = None
        self.seamless_processor: Optional[AutoProcessor] = None
        self.chatterbox: Optional[ChatterboxMultilingualTTS] = None

    def load_models(self) -> None:
        if self.seamless_model and self.chatterbox:
            return

        print(f"Loading models on {DEVICE}...")
        self.seamless_processor = AutoProcessor.from_pretrained("facebook/seamless-m4t-v2-large")
        self.seamless_model = SeamlessM4Tv2ForSpeechToText.from_pretrained(
            "facebook/seamless-m4t-v2-large"
        ).to(DEVICE)

        self.chatterbox = ChatterboxMultilingualTTS.from_pretrained(device=DEVICE)
        self.chatterbox.t3.tfmr.config._attn_implementation = "eager"
        print("Models loaded.")


_state = AppState()


def get_state() -> AppState:
    return _state

