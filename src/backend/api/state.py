import logging
from typing import Optional

import torch
from transformers import AutoProcessor, SeamlessM4Tv2ForSpeechToText
from chatterbox.mtl_tts import ChatterboxMultilingualTTS

logger = logging.getLogger(__name__)


def _resolve_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


DEVICE = _resolve_device()


_original_torch_load = torch.load


def _patched_torch_load(*args, **kwargs):
    if "map_location" not in kwargs:
        kwargs["map_location"] = DEVICE
    return _original_torch_load(*args, **kwargs)


torch.load = _patched_torch_load


def _log_memory():
    """Log GPU memory usage if available."""
    if DEVICE == "cuda":
        allocated = torch.cuda.memory_allocated() / 1e9
        reserved = torch.cuda.memory_reserved() / 1e9
        logger.info(f"GPU Memory - Allocated: {allocated:.2f}GB, Reserved: {reserved:.2f}GB")
    elif DEVICE == "mps":
        logger.info("MPS device (memory stats not available)")


class AppState:
    def __init__(self):
        self.voice_reference_path: Optional[str] = None
        self.seamless_model: Optional[SeamlessM4Tv2ForSpeechToText] = None
        self.seamless_processor: Optional[AutoProcessor] = None
        self.chatterbox: Optional[ChatterboxMultilingualTTS] = None

    def load_models(self) -> None:
        if self.seamless_model and self.chatterbox:
            return

        # Use fp16 on GPU for lower memory usage
        use_fp16 = DEVICE in ("cuda", "mps")
        dtype = torch.float16 if use_fp16 else torch.float32
        
        logger.info(f"Loading models on {DEVICE} (dtype={dtype})")

        # Load SeamlessM4T with fp16 if on GPU
        self.seamless_processor = AutoProcessor.from_pretrained("facebook/seamless-m4t-v2-large")
        self.seamless_model = SeamlessM4Tv2ForSpeechToText.from_pretrained(
            "facebook/seamless-m4t-v2-large",
            dtype=dtype
        ).to(DEVICE)
        
        logger.info("SeamlessM4T loaded")
        _log_memory()

        # Load Chatterbox then convert to fp16 if on GPU
        self.chatterbox = ChatterboxMultilingualTTS.from_pretrained(device=DEVICE)
        self.chatterbox.t3.tfmr.config._attn_implementation = "eager"
        
        logger.info("Chatterbox loaded")
        _log_memory()
        
        logger.info("All models loaded successfully")


_state = AppState()


def get_state() -> AppState:
    return _state
