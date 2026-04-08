import hashlib
import platform


def generate_fingerprint() -> str:
    components = [
        platform.node() or "unknown-host",
        platform.system(),
        platform.machine(),
        platform.python_version(),
    ]
    return hashlib.sha256("|".join(components).encode()).hexdigest()[:16]
