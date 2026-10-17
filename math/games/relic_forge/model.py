"""Server-only Last Petal model. Amounts are integer hundredths of total bet.
Natural sampling and weighted export are different distributions: only exported
lookup weights define measured development RTP. No browser outcome generation.
"""
import json
import random
from copy import deepcopy
from pathlib import Path

RULES = json.loads(Path(__file__).with_name('rules.json').read_text())
SYMBOLS = list(RULES['paytable'])
MODES = tuple(RULES['modes'])
BONUS_RULES = json.loads(Path(__file__).with_name('bonus_rules.json').read_text())
BONUS_MODES = tuple(BONUS_RULES)
ALL_MODES = MODES + BONUS_MODES
CAP = RULES['cap']
REELS = [[SYMBOLS[(i * 3 + r * 5 + i // 8) % 8] for i in range(97)] for r in range(5)]

def attach_purchase_cost(book,cost):
    """Bind the exported purchase price to its book for immutable recovery receipts.
    Payout amounts always remain in original base-bet units.
    """
    if book['events'][0]['type']=='bonusStart':
        if not isinstance(cost,int) or cost<=0: raise ValueError('Invalid purchase price')
        book['events'][0]['purchaseCostMultiplier']=cost
    return book

def evaluate(board, expanded, budget=CAP):
    """Best LTR match/line; all-Wild pays keeper. Sum participating reel
    multipliers once (identity 1). Cap credits lines in ascending line order.
    """
    wins = []
    for index, line in enumerate(RULES['lines'], 1):
        cells = [board[r][line[r]] for r in range(5)]
        best = None
        for symbol, pays in RULES['paytable'].items():
            count = 0
            for cell in cells:
                if cell not in (symbol, 'wild'):
                    break
                count += 1
            if count < 3:
                continue
            mult = max(1, sum(expanded.get(r, 0) for r in range(count) if cells[r] == 'wild'))
            base = pays[count - 3]
            value = base * mult
            if best is None or value > best['uncappedWin']:
                best = dict(symbol=symbol, kind=count, win=value, uncappedWin=value,
                    positions=[dict(reel=r, row=line[r]) for r in range(count)],
                    meta=dict(lineIndex=index, winWithoutMult=base, lineMultiplier=mult))
        if best is not None and budget > 0:
            best['win'] = min(best['win'], budget)
            budget -= best['win']
            wins.append(best)
    return sum(w['win'] for w in wins), wins

def generate(mode, seed, scenario=None):
    if mode not in ALL_MODES:
        raise ValueError('Unsupported Last Petal mode')
    rng = random.Random(seed)
    purchase = BONUS_RULES.get(mode)
    world = purchase['world'] if purchase else mode
    settings = dict(RULES['modes'][world])
    if purchase:
        settings.update(freeWildChance=purchase['freeWildChance'],multipliers=purchase['multipliers'])
    spin = 0
    events, sticky = [], {}
    total = base_win = feature_win = 0
    def emit(kind, **data):
        events.append(dict(index=len(events), type=kind, **data))
    def reveal(free=False, force=None):
        nonlocal total, base_win, feature_win
        board = []
        for strip in REELS:
            stop = rng.randrange(len(strip))
            board.append([strip[(stop + row) % len(strip)] for row in range(5)])
        expanding = dict(sticky) if free else {}
        new = []
        chance = settings['freeWildChance' if free else 'baseWildChance']
        for reel in range(5):
            if reel not in expanding and rng.random() < chance:
                expanding[reel] = rng.choice(settings['multipliers'])
                new.append(dict(reel=reel, row=rng.randrange(5), multiplier=expanding[reel]))
        if purchase and free and spin==1 and purchase['startingWildReels']:
            # Pick the guaranteed reel and enhanced value on the server before reveal.
            reel = rng.randrange(5)
            multiplier = rng.choice([m for m in settings['multipliers'] if m>=purchase['minimumStartingMultiplier']])
            expanding[reel] = multiplier
            new = [w for w in new if w['reel']!=reel]
            new.append(dict(reel=reel,row=rng.randrange(5),multiplier=multiplier))
        if force in ('expanding','multiple','cap'):
            expanding = {1:2} if force == 'expanding' else {1:2,3:3} if force == 'multiple' else {r:max(settings['multipliers']) for r in range(5)}
            new = [dict(reel=r,row=2,multiplier=m) for r,m in expanding.items()]
            for r in range(5):
                board[r][2] = 'keeper'
        if force == 'small':
            expanding, new = {}, []
            for r in range(3):
                board[r][0] = 'flower'
        if force == 'lines':
            expanding, new = {}, []
            board = [['guardian'] * 5 for _ in range(5)]
        if force == 'loss':
            expanding, new = {}, []
            # Keep showcase losses on natural reel strips, with mixed symbols.
            # This forced scenario never changes ordinary outcome sampling.
            for attempt in range(1001):
                if all(len(set(column)) >= 3 for column in board) and evaluate(board, {})[0] == 0:
                    break
                if attempt == 1000:
                    raise RuntimeError('Unable to generate a mixed showcase loss')
                board = []
                for strip in REELS:
                    stop = rng.randrange(len(strip))
                    board.append([strip[(stop + row) % len(strip)] for row in range(5)])
        for reel in expanding:
            if free and reel in sticky:
                board[reel] = ['wild'] * 5
            else:
                row = next(w['row'] for w in new if w['reel'] == reel)
                board[reel][row] = 'wild'
        if force == 'bonus':
            expanding, new = {}, []
            # Remove seed Wilds to avoid an unexpanded special on trigger boards.
            board = [[s if s != 'wild' else 'flower' for s in col] for col in board]
            for r in (0,2,4):
                board[r][1] = 'scatter'
        emit('reveal', board=deepcopy(board), gameType='freegame' if free else 'basegame',
             world=world, mode=mode, contract=RULES['version'], anticipation=[0,0,0,0,int(force == 'bonus')])
        if new:
            emit('expandWilds', wilds=new, sticky=free)
        for reel in expanding:
            board[reel] = ['wild'] * 5
        if free:
            sticky.update(expanding)
            emit('stickyWildState', wilds=[dict(reel=r,multiplier=m) for r,m in sorted(sticky.items())])
        value, wins = evaluate(board, expanding, CAP-total)
        emit('winInfo', totalWin=value, wins=wins)
        total += value
        if free:
            feature_win += value
        else:
            base_win += value
        emit('setWin', amount=value)
        emit('setTotalWin', amount=total)
    bonus = bool(purchase) or scenario in ('bonus','cap') or (scenario is None and rng.random() < settings['bonusProbability'])
    if purchase:
        emit('bonusStart',contract=RULES['version'],world=world,mode=mode,variant=purchase['variant'],totalFs=10)
    else:
        reveal(force='bonus' if bonus else scenario)
    if bonus and total < CAP:
        if not purchase:
            emit('freeSpinTrigger', totalFs=10)
        for spin in range(1,11):
            if total >= CAP:
                break
            emit('updateFreeSpin', amount=spin,total=10)
            reveal(free=True, force='cap' if scenario=='cap' and spin==1 else None)
        emit('freeSpinEnd', amount=feature_win)
    if total == CAP:
        emit('wincap', amount=CAP)
    emit('finalWin', amount=total)
    return dict(id=seed,payoutMultiplier=total,events=events,
        criteria='feature' if bonus else 'base',baseGameWins=base_win/100,freeGameWins=feature_win/100)
