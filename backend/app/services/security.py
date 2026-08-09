import re

# List of common jailbreak patterns and malicious intent words
JAILBREAK_PATTERNS = [
    r"ignore all previous instructions",
    r"you are no longer",
    r"system prompt",
    r"developer mode",
    r"dan \(do anything now\)",
    r"bypass",
    r"you must obey",
    r"forget your instructions"
]

def check_for_jailbreak(text: str) -> bool:
    text_lower = text.lower()
    for pattern in JAILBREAK_PATTERNS:
        if re.search(pattern, text_lower):
            return True
    return False
