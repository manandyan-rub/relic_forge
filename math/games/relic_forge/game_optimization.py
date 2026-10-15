"""Legacy six-mode optimization is deliberately retired."""
from model import MODES
class OptimizationSetup:
    def __init__(self, config):
        raise RuntimeError('Use run.py for measured finite development weights. Production optimization remains pending.')
