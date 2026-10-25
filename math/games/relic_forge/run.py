"""Build measured finite development libraries. Never uploads or exports production."""
import argparse, csv, json, math
from pathlib import Path
import zstandard
from distribution import POLICY, distribute_weight, calibrate_bonus
from model import RULES, MODES, BONUS_MODES, BONUS_RULES, REELS, generate, attach_purchase_cost
ROOT=Path(__file__).resolve().parent
FRONT=ROOT.parents[2]/'frontend'/'apps'/'relic-forge'

def build(mode, count):
    books=[generate(mode,i) for i in range(count)]
    # Stratified feature sample and explicit maximum exposure make the finite
    # development distribution inspectable, including its rare-event ceiling.
    books += [generate(mode,100000+i,'bonus') for i in range(max(200,count//10))]
    books += [generate(mode,900000,'cap')]
    groups={'loss':[], 'win':[], 'feature':[], 'cap':[]}
    for b in books:
        group='cap' if b['payoutMultiplier']>=RULES['cap'] else 'feature' if b['criteria']=='feature' else 'win' if b['payoutMultiplier'] else 'loss'
        groups[group].append(b)
    avg=lambda g:sum(b['payoutMultiplier']/100 for b in groups[g])/len(groups[g])
    pcap=POLICY['baseCapProbability']
    pfeature=RULES['modes'][mode]['bonusProbability']-pcap
    pwin=(.96-pfeature*avg('feature')-pcap*5000)/avg('win')
    probs={'feature':pfeature,'cap':pcap,'win':pwin,'loss':1-pfeature-pcap-pwin}
    if any(p<=0 for p in probs.values()):
        raise RuntimeError(f'Infeasible development weights: {mode} {probs}')
    rows=[]
    for group,items in groups.items():
        rows += distribute_weight(items,round(probs[group]*POLICY['integerWeightBudget']))
    total=sum(w for _,w in rows)
    mean=sum(b['payoutMultiplier']/100*w for b,w in rows)/total
    variance=sum((b['payoutMultiplier']/100-mean)**2*w for b,w in rows)/total
    report=dict(mode=mode,libraryBooks=len(rows),weightSum=total,weightedRtp=mean,
        standardDeviationX=math.sqrt(variance),varianceX=variance,
        hitFrequency=sum(w for b,w in rows if b['payoutMultiplier']>0)/total,
        bonusFrequency=sum(w for b,w in rows if b['criteria']=='feature')/total,
        meanFeatureRoundX=sum(b['payoutMultiplier']/100*w for b,w in rows if b['criteria']=='feature')/sum(w for b,w in rows if b['criteria']=='feature'),
        maxExposureX=max(b['payoutMultiplier'] for b,_ in rows)/100,
        naturalSampleRtp=sum(b['payoutMultiplier'] for b in books[:count])/100/count,
        tail5000Probability=sum(w for b,w in rows if b['payoutMultiplier']>=RULES['cap'])/total,
        distributionPolicy=POLICY['version'],
        status='Finite development library, calibrated group weights; not production optimized or certified')
    return rows,report

def build_bonus(mode,count):
    """Price and calibrate the finite population under tail and cost limits."""
    offset=1000000+BONUS_MODES.index(mode)*100000
    books=[generate(mode,offset+i) for i in range(count)]
    natural_mean=sum(b['payoutMultiplier'] for b in books)/100/len(books)
    rows,cost,calibration=calibrate_bonus(books,generate(mode,offset+90000,'cap'),RULES['cap'])
    for book,_ in rows: attach_purchase_cost(book,cost)
    total=sum(w for _,w in rows)
    mean=sum(b['payoutMultiplier']/100*w for b,w in rows)/total
    variance=sum((b['payoutMultiplier']/100-mean)**2*w for b,w in rows)/total
    report=dict(mode=mode,world=BONUS_RULES[mode]['world'],variant=BONUS_RULES[mode]['variant'],
        costMultiplier=cost,libraryBooks=len(rows),weightSum=total,weightedRtp=mean/cost,
        meanPayoutBaseBetX=mean,standardDeviationBaseBetX=math.sqrt(variance),
        standardDeviationPurchaseX=math.sqrt(variance)/cost,varianceBaseBetX=variance,
        hitFrequency=sum(w for b,w in rows if b['payoutMultiplier']>0)/total,
        maxPayoutBaseBetX=max(b['payoutMultiplier'] for b,_ in rows)/100,
        maxPayoutPurchaseX=5000/cost,naturalMeanPayoutBaseBetX=natural_mean,
        tail5000Probability=sum(w for b,w in rows if b['payoutMultiplier']>=RULES['cap'])/total,
        **calibration,
        status='Locally validated finite development books; connected purchase release is locked')
    return rows,report

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--sims',type=int,default=5000)
    parser.add_argument('--command',choices=['smoke','config','verify-strict','production'],default='smoke')
    args=parser.parse_args()
    if args.command=='production': raise RuntimeError('Production export is disabled pending independent validation.')
    if args.command=='verify-strict':
        import subprocess,sys
        raise SystemExit(subprocess.call([sys.executable,'-m','pytest',str(ROOT/'test_relic_wild.py'),'-q']))
    if args.sims<1000: raise ValueError('At least 1000 development samples per world are required.')
    dest=ROOT/'library'/'last_petal_dev'
    dest.mkdir(parents=True,exist_ok=True)
    reports=[]
    index={'modes':[]}
    fixtures={}
    for mode in MODES:
        rows,report=build(mode,args.sims)
        reports.append(report)
        with (dest/f'books_{mode}.jsonl.zst').open('wb') as f:
            with zstandard.ZstdCompressor().stream_writer(f) as stream:
                for book,_ in rows:
                    stream.write((json.dumps(book,separators=(',',':'))+'\n').encode())
        with (dest/f'lookUpTable_{mode}.csv').open('w',newline='') as f:
            writer=csv.writer(f)
            writer.writerows((b['id'],w,b['payoutMultiplier']) for b,w in rows)
        index['modes'].append(dict(name=mode,cost=1,events=f'books_{mode}.jsonl.zst',weights=f'lookUpTable_{mode}.csv'))
        fixtures[mode]=[generate(mode,777+i,scenario) for i,scenario in enumerate(['loss','small','expanding','multiple','bonus','lines','cap'])]
    bonus_reports=[]
    bonus_fixtures={}
    bonus_config={}
    for mode in BONUS_MODES:
        rows,report=build_bonus(mode,max(1000,args.sims//2))
        bonus_reports.append(report)
        with (dest/f'books_{mode}.jsonl.zst').open('wb') as f:
            with zstandard.ZstdCompressor().stream_writer(f) as stream:
                for book,_ in rows: stream.write((json.dumps(book,separators=(',',':'))+'\n').encode())
        with (dest/f'lookUpTable_{mode}.csv').open('w',newline='') as f:
            csv.writer(f).writerows((b['id'],w,b['payoutMultiplier']) for b,w in rows)
        cost=report['costMultiplier']
        index['modes'].append(dict(name=mode,cost=cost,events=f'books_{mode}.jsonl.zst',weights=f'lookUpTable_{mode}.csv'))
        bonus_config[mode]=dict(BONUS_RULES[mode],costMultiplier=cost,buyBonus=True,freeSpins=10,connectedApproved=False)
        bonus_fixtures[mode]=[attach_purchase_cost(generate(mode,7000000+BONUS_MODES.index(mode)*100+i),cost) for i in range(3)]
    (dest/'bonus_config.json').write_text(json.dumps(bonus_config,indent=2))
    (ROOT/'bonus_pricing.json').write_text(json.dumps(bonus_config,indent=2))
    from game_config import GameConfig
    from src.write_data.write_configs import pass_fe_betmode
    sdk_config=GameConfig(artifact_root=str(dest))
    stake_modes={'developmentOnly':True,'gameModes':[
        dict(mode=m.get_name(),**pass_fe_betmode(m)[m.get_name()]) for m in sdk_config.bet_modes]}
    (dest/'stake-mode-config.json').write_text(json.dumps(stake_modes,indent=2))
    (dest/'bonus_statistics.json').write_text(json.dumps(bonus_reports,indent=2))
    (dest/'index.json').write_text(json.dumps(index,indent=2))
    (dest/'statistics.json').write_text(json.dumps(reports,indent=2))
    (dest/'rules.json').write_text(json.dumps(RULES,indent=2))
    (dest/'distribution_policy.json').write_text(json.dumps(POLICY,indent=2))
    with (dest/'reels.csv').open('w',newline='') as f: csv.writer(f).writerows(zip(*REELS))
    target=FRONT/'src'/'petal'
    target.mkdir(parents=True,exist_ok=True)
    (target/'rules.json').write_text(json.dumps(RULES,indent=2))
    (target/'fixtures.json').write_text(json.dumps(fixtures,separators=(',',':')))
    (target/'statistics.json').write_text(json.dumps(reports,indent=2))
    (target/'bonus-config.json').write_text(json.dumps(bonus_config,indent=2))
    (target/'bonus-fixtures.json').write_text(json.dumps(bonus_fixtures,separators=(',',':')))
    (target/'bonus-statistics.json').write_text(json.dumps(bonus_reports,indent=2))
    # Hash exact book/config/weight artifacts for independent staging review.
    import hashlib
    artifact_names={'index.json','statistics.json','bonus_statistics.json','bonus_config.json','stake-mode-config.json','rules.json','reels.csv','distribution_policy.json'}
    for item in index['modes']: artifact_names.update((item['events'],item['weights']))
    integrity={name:hashlib.sha256((dest/name).read_bytes()).hexdigest() for name in sorted(artifact_names)}
    (dest/'integrity.json').write_text(json.dumps(integrity,indent=2))
    print(json.dumps(reports+bonus_reports,indent=2))
if __name__=='__main__': main()
