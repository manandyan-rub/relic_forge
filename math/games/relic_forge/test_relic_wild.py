"""Last Petal mechanical and weighted-library regression tests."""
import csv, json, math
from pathlib import Path
import pytest
import zstandard
from model import RULES,MODES,ALL_MODES,BONUS_MODES,BONUS_RULES,CAP,generate,evaluate
from game_events import EVENT_TYPES
ROOT=Path(__file__).resolve().parent

def verify(book):
    total=0;sticky={};feature=False;remaining=0;board=None;exp={};feature_total=0
    for i,e in enumerate(book['events']):
        assert e['index']==i and e['type'] in EVENT_TYPES
        if e['type']=='bonusStart':
            assert i==0 and e['mode'] in BONUS_MODES and e['totalFs']==10
            feature=True;remaining=10
        elif e['type']=='reveal':
            assert e['contract']==RULES['version']
            assert len(e['board'])==5 and all(len(c)==5 for c in e['board'])
            board=[c[:] for c in e['board']]
            exp=dict(sticky) if feature else {}
            for r in sticky: assert board[r]==['wild']*5
        elif e['type']=='expandWilds':
            for w in e['wilds']:
                assert board[w['reel']][w['row']]=='wild'
                assert w['reel'] not in exp
                exp[w['reel']]=w['multiplier'];board[w['reel']]=['wild']*5
        elif e['type']=='stickyWildState':
            new={w['reel']:w['multiplier'] for w in e['wilds']}
            assert all(new.get(r)==v for r,v in sticky.items())
            assert new==exp;sticky=new
        elif e['type']=='winInfo':
            value,wins=evaluate(board,exp,CAP-total)
            assert value==e['totalWin'] and wins==e['wins']
            total+=value
            if feature:feature_total+=value
        elif e['type']=='setTotalWin': assert total==e['amount']
        elif e['type']=='freeSpinTrigger':
            assert sum(s=='scatter' for c in board for s in c)==3
            assert e['totalFs']==10;feature=True;remaining=10
        elif e['type']=='updateFreeSpin':
            assert e['amount']==11-remaining;remaining-=1
        elif e['type']=='freeSpinEnd':
            assert remaining==0 or total==CAP
            assert e['amount']==feature_total
        elif e['type']=='finalWin': assert e['amount']==total==book['payoutMultiplier'] and i==len(book['events'])-1
        assert 0<=total<=CAP
    assert book['baseGameWins']+book['freeGameWins']==pytest.approx(total/100)

@pytest.mark.parametrize('mode',MODES)
@pytest.mark.parametrize('scenario',['loss','small','lines','expanding','multiple','bonus','cap'])
def test_representative_books(mode,scenario):
    b=generate(mode,777,scenario);verify(b)
    if scenario=='loss':assert b['payoutMultiplier']==0
    if scenario=='cap':assert b['payoutMultiplier']==CAP
    if scenario=='bonus':assert sum(e['type']=='reveal' for e in b['events'])==11

@pytest.mark.parametrize('mode',MODES)
def test_showcase_loss_is_mixed_deterministic_and_mirrored(mode):
    book=generate(mode,777,'loss')
    assert book==generate(mode,777,'loss')
    board=book['events'][0]['board']
    assert all(len(set(column))>=3 for column in board)
    assert evaluate(board,{})==(0,[])
    assert book['payoutMultiplier']==0
    fixtures=ROOT.parents[2]/'frontend'/'apps'/'relic-forge'/'src'/'petal'/'fixtures.json'
    assert json.loads(fixtures.read_text())[mode][0]==book

def test_twenty_unique_five_row_paylines():
    assert len(RULES['lines'])==len(set(map(tuple,RULES['lines'])))==20
    assert all(len(line)==5 and all(0<=r<5 for r in line) for line in RULES['lines'])

def test_additive_reel_multipliers_no_double_count():
    board=[['flower']*5 for _ in range(5)]
    board[1]=['wild']*5;board[3]=['wild']*5
    total,wins=evaluate(board,{1:2,3:3})
    assert len(wins)==20 and all(w['meta']['lineMultiplier']==5 for w in wins)
    assert total==20*RULES['paytable']['flower'][2]*5

def test_wild_does_not_substitute_scatter():
    board=[['scatter']*5,['wild']*5,['scatter']*5,['wild']*5,['scatter']*5]
    assert evaluate(board,{1:10,3:10})[0]==0

def test_left_to_right_and_all_wild():
    board=[['key']*5,['book']*5,['keeper']*5,['keeper']*5,['keeper']*5]
    assert evaluate(board,{})[0]==0
    total,wins=evaluate([['wild']*5 for _ in range(5)],{r:2 for r in range(5)})
    assert all(w['symbol']=='keeper' for w in wins)
    assert total==20*RULES['paytable']['keeper'][2]*10

def test_cap_credits_only_remaining_budget():
    value,wins=evaluate([['guardian']*5 for _ in range(5)],{},17)
    assert value==17 and sum(w['win'] for w in wins)==17
    assert len(wins)==1 and wins[0]['uncappedWin']>17

@pytest.mark.parametrize('mode',MODES)
def test_sticky_progression_and_reproducibility(mode):
    for seed in range(100):
        b=generate(mode,seed,'bonus');verify(b)
        assert b==generate(mode,seed,'bonus')

def test_unknown_modes_fail():
    with pytest.raises(ValueError):generate('BASE',0)

def test_sdk_bridge():
    from game_config import GameConfig
    from gamestate import GameState
    config=GameConfig(artifact_root=str(ROOT/'library'/'last_petal_dev'/'sdk_check'))
    assert config.num_rows==[5]*5
    assert [m.get_name() for m in config.bet_modes]==list(ALL_MODES)
    pricing=json.loads((ROOT/'bonus_pricing.json').read_text())
    for m in config.bet_modes:
        if m.get_name() in BONUS_MODES:
            assert m.get_buybonus() and m.get_cost()==pricing[m.get_name()]['costMultiplier']
    state=GameState(config);state.betmode='BLOOM';state.criteria='natural';state.run_spin(12,12)
    assert state.book.to_json()['events']==generate('BLOOM',12)['events']
    assert state.book.to_json()['payoutMultiplier']==generate('BLOOM',12)['payoutMultiplier']

@pytest.mark.parametrize('mode',MODES)
def test_entire_exported_library_and_weighted_statistics(mode):
    dest=ROOT/'library'/'last_petal_dev'
    with (dest/f'books_{mode}.jsonl.zst').open('rb') as stream:
        data=zstandard.ZstdDecompressor().stream_reader(stream).read().decode()
    books={b['id']:b for b in map(json.loads,data.splitlines())}
    with (dest/f'lookUpTable_{mode}.csv').open() as f: rows=[tuple(map(int,r)) for r in csv.reader(f)]
    assert len(rows)==len(books) and all(w>0 and b in books and p==books[b]['payoutMultiplier'] for b,w,p in rows)
    for b in books.values():verify(b)
    weight=sum(w for _,w,_ in rows)
    rtp=sum(w*p/100 for _,w,p in rows)/weight
    assert abs(rtp-.96)<1e-6
    assert max(p for _,_,p in rows)==CAP
    s=next(s for s in json.loads((dest/'statistics.json').read_text()) if s['mode']==mode)
    assert s['weightedRtp']==pytest.approx(rtp)
    assert s['bonusFrequency']==pytest.approx(RULES['modes'][mode]['bonusProbability'],abs=1e-8)

def test_world_distributions_differ_as_specified():
    bloom,blight=json.loads((ROOT/'library'/'last_petal_dev'/'statistics.json').read_text())
    assert bloom['bonusFrequency']>blight['bonusFrequency']
    assert bloom['meanFeatureRoundX']<blight['meanFeatureRoundX']
    assert bloom['varianceX']<blight['varianceX']

@pytest.mark.parametrize('mode',BONUS_MODES)
def test_bonus_guarantees_and_immediate_entry(mode):
    definition=BONUS_RULES[mode]
    for seed in range(100):
        book=generate(mode,seed)
        verify(book)
        assert book['events'][0]['type']=='bonusStart'
        assert not any(e['type']=='freeSpinTrigger' for e in book['events'])
        assert book['baseGameWins']==0
        assert all(e.get('gameType')!='basegame' for e in book['events'])
        assert book==generate(mode,seed)
        reveals=[e for e in book['events'] if e['type']=='reveal']
        assert len(reveals)==10 or book['payoutMultiplier']==CAP
        end=next(i for i,e in enumerate(book['events']) if e['type']=='winInfo')
        first_wilds=[w for e in book['events'][:end] if e['type']=='expandWilds' for w in e['wilds']]
        assert len(first_wilds)>=definition['startingWildReels']
        if definition['startingWildReels']:
            assert max(w['multiplier'] for w in first_wilds)>=definition['minimumStartingMultiplier']
        for e in book['events']:
            if e['type']=='expandWilds':assert all(w['multiplier'] in definition['multipliers'] for w in e['wilds'])

@pytest.mark.parametrize('mode',BONUS_MODES)
def test_bonus_export_statistics_and_prices(mode):
    dest=ROOT/'library'/'last_petal_dev'
    with (dest/f'books_{mode}.jsonl.zst').open('rb') as f:
        books={b['id']:b for b in map(json.loads,zstandard.ZstdDecompressor().stream_reader(f).read().decode().splitlines())}
    with (dest/f'lookUpTable_{mode}.csv').open() as f:rows=[tuple(map(int,r)) for r in csv.reader(f)]
    assert len(rows)==len(books)==len(set(b for b,_,_ in rows))
    assert all(w>0 and p==books[b]['payoutMultiplier'] for b,w,p in rows)
    for book in books.values():
        verify(book)
        definition=BONUS_RULES[mode]
        end=next(i for i,e in enumerate(book['events']) if e['type']=='winInfo')
        initial=[w for e in book['events'][:end] if e['type']=='expandWilds' for w in e['wilds']]
        assert len(initial)>=definition['startingWildReels']
        if definition['startingWildReels']:
            assert max(w['multiplier'] for w in initial)>=definition['minimumStartingMultiplier']
    total=sum(w for _,w,_ in rows)
    mean=sum(p*w for _,w,p in rows)/100/total
    variance=sum(w*(p/100-mean)**2 for _,w,p in rows)/total
    stat=next(s for s in json.loads((dest/'bonus_statistics.json').read_text()) if s['mode']==mode)
    cost=stat['costMultiplier']
    assert abs(mean/cost-.96)<1e-7
    assert stat['weightedRtp']==pytest.approx(mean/cost)
    assert stat['standardDeviationBaseBetX']==pytest.approx(math.sqrt(variance))
    assert stat['standardDeviationPurchaseX']==pytest.approx(math.sqrt(variance)/cost)
    assert stat['maxPayoutBaseBetX']==max(p for _,_,p in rows)/100==5000
    assert stat['maxPayoutPurchaseX']==5000/cost
    pricing=json.loads((ROOT/'bonus_pricing.json').read_text())
    assert cost==max(1,round(stat['naturalMeanPayoutBaseBetX']/.96))
    assert pricing[mode]['costMultiplier']==cost and pricing[mode]['connectedApproved'] is False
    assert all(b['events'][0]['purchaseCostMultiplier']==cost for b in books.values())
    index=json.loads((dest/'index.json').read_text())
    assert next(m for m in index['modes'] if m['name']==mode)['cost']==cost
    sdk=json.loads((dest/'stake-mode-config.json').read_text())
    advertised=next(m for m in sdk['gameModes'] if m['mode']==mode)
    assert sdk['developmentOnly'] and advertised['cost']==cost and advertised['buyBonus'] is True

def test_six_independent_bonus_distributions_and_artifact_integrity():
    import hashlib
    dest=ROOT/'library'/'last_petal_dev'
    assert len(BONUS_MODES)==6
    signatures=[]
    for mode in BONUS_MODES:
        outcomes=[]
        for seed in range(20):
            book=generate(mode,13421+seed)
            outcomes.append((book['payoutMultiplier'],[e['wilds'] for e in book['events'] if e['type']=='expandWilds']))
        signatures.append(json.dumps(outcomes))
    assert len(set(signatures))==6
    for name,expected in json.loads((dest/'integrity.json').read_text()).items():
        assert hashlib.sha256((dest/name).read_bytes()).hexdigest()==expected
    for mode in BONUS_MODES:
        cap=generate(mode,139,'cap');verify(cap);assert cap['payoutMultiplier']==CAP

