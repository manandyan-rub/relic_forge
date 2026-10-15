"""SDK config for the canonical Last Petal development contract."""
from src.config.config import Config
from src.config.betmode import BetMode
from src.config.distributions import Distribution
import json
from pathlib import Path
from model import RULES, REELS, ALL_MODES, BONUS_MODES
class GameConfig(Config):
    def __init__(self, production=False, artifact_root=None):
        super().__init__()
        if production:
            raise RuntimeError('Production export disabled pending independent math validation.')
        self.game_id = 'relic_forge'
        self.game_name = self.working_name = 'The Last Petal'
        self.provider_name, self.provider_number = 'last_petal_development', 0
        self.artifact_root = artifact_root
        self.rtp, self.wincap = .96, 5000
        self.num_reels, self.num_rows, self.include_padding = 5, [5]*5, False
        self.paytable = {(n+3,s):v/100 for s,pays in RULES['paytable'].items() for n,v in enumerate(pays)}
        self.paylines = {i+1:line for i,line in enumerate(RULES['lines'])}
        self.special_symbols = {'wild':['wild'],'scatter':['scatter']}
        self.freespin_triggers = {self.basegame_type:{3:10,4:10,5:10},self.freegame_type:{}}
        self.reels = {'PETAL':REELS}
        pricing=json.loads(Path(__file__).with_name('bonus_pricing.json').read_text())
        self.bet_modes = [BetMode(name=m,cost=pricing[m]['costMultiplier'] if m in BONUS_MODES else 1,rtp=.96,max_win=5000,auto_close_disabled=False,
            is_feature=False,is_buybonus=m in BONUS_MODES,distributions=[Distribution(criteria='natural',quota=1,conditions={'reel_weights':{self.basegame_type:{'PETAL':1},self.freegame_type:{'PETAL':1}},'force_freegame':m in BONUS_MODES,'force_wincap':False})]) for m in ALL_MODES]
        self.construct_paths()
