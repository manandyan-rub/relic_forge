"""Server generation entry point; old cell-Wild execution retired."""
from model import generate
class GameExecutables:
    generate_book = staticmethod(generate)
