from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Any

import yaml


BACKEND_DIR = Path(__file__).resolve().parent.parent
CONFIG_DIR = BACKEND_DIR / "config"


def _load_yaml_file(name: str) -> Dict[str, Any]:
    path = CONFIG_DIR / f"{name}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Missing config file: {path}")
    with path.open("r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


@lru_cache(maxsize=1)
def get_language_map() -> Dict[str, Dict[str, str]]:
    data = _load_yaml_file("supported_languages")
    return data.get("languages", {})


@lru_cache(maxsize=1)
def get_effect_configs() -> Dict[str, Dict[str, Any]]:
    data = _load_yaml_file("effects")
    return data.get("effects", {})


def list_languages(include_english: bool = False) -> List[str]:
    languages = list(get_language_map().keys())
    if include_english:
        return languages
    return [lang for lang in languages if lang.lower() != "english"]


def get_seamless_code(language: str) -> str:
    return get_language_map().get(language, {}).get("seamless", "eng")


def get_chatterbox_code(language: str) -> str:
    return get_language_map().get(language, {}).get("chatterbox", "en")
