from typing import Dict, Any

import numpy as np
from pedalboard import (
    Pedalboard,
    Chorus,
    Reverb,
    Distortion,
    Gain,
    Compressor,
    HighpassFilter,
    LowpassFilter,
    NoiseGate,
    Limiter,
    Phaser,
    Delay,
    PitchShift,
    Bitcrush,
    Clipping,
    GSMFullRateCompressor,
    HighShelfFilter,
    LowShelfFilter,
    MP3Compressor,
    LadderFilter,
    PeakFilter,
    Resample,
)

from api.config import get_effect_configs


EFFECT_CLASS_MAP = {
    "Chorus": Chorus,
    "Reverb": Reverb,
    "Distortion": Distortion,
    "Gain": Gain,
    "Compressor": Compressor,
    "HighpassFilter": HighpassFilter,
    "LowpassFilter": LowpassFilter,
    "NoiseGate": NoiseGate,
    "Limiter": Limiter,
    "Phaser": Phaser,
    "Delay": Delay,
    "PitchShift": PitchShift,
    "Bitcrush": Bitcrush,
    "Clipping": Clipping,
    "GSMFullRateCompressor": GSMFullRateCompressor,
    "HighShelfFilter": HighShelfFilter,
    "LowShelfFilter": LowShelfFilter,
    "MP3Compressor": MP3Compressor,
    "LadderFilter": LadderFilter,
    "PeakFilter": PeakFilter,
    "Resample": Resample,
}


def get_effect_definitions() -> Dict[str, Any]:
    return get_effect_configs()


def build_pedalboard(config: Dict[str, Dict[str, float]]) -> Pedalboard:
    chain = []
    registry = get_effect_definitions()
    for fx_name, params in config.items():
        effect_cfg = registry.get(fx_name)
        if not effect_cfg:
            continue
        cls = EFFECT_CLASS_MAP.get(effect_cfg["class"])
        if not cls:
            continue
        kwargs = {}
        for param_name, values in effect_cfg.get("params", {}).items():
            val = params.get(param_name, values.get("default"))
            if param_name in {"semitones", "bit_depth", "target_sample_rate"}:
                val = int(round(val))
            kwargs[param_name] = val
        try:
            chain.append(cls(**kwargs))
        except Exception as exc:
            print(f"[FX] Unable to add {fx_name}: {exc}")
    return Pedalboard(chain)


def apply_effects(audio: np.ndarray, sr: int, config: Dict[str, Dict[str, float]]) -> np.ndarray:
    if not config:
        return audio
    board = build_pedalboard(config)
    if len(audio.shape) == 1:
        audio = audio.reshape(1, -1)
    return board(audio.astype(np.float32), sr)

