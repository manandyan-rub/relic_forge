"""Last Petal event vocabulary; model emits a snapshot after each mutation."""
EVENT_TYPES = frozenset(('bonusStart','reveal','expandWilds','stickyWildState','winInfo','setWin','setTotalWin',
    'freeSpinTrigger','updateFreeSpin','freeSpinEnd','wincap','finalWin'))
