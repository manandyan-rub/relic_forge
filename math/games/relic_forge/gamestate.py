"""Bridge integer Last Petal books into the existing Stake Math SDK state."""
from src.state.state import GeneralGameState
from model import generate, attach_purchase_cost
class GameState(GeneralGameState):
    def assign_special_sym_function(self):
        self.special_symbol_functions = {}
    def run_spin(self, sim, simulation_seed=None):
        self.sim = sim
        self.reset_book()
        data = generate(self.betmode, sim if simulation_seed is None else simulation_seed)
        attach_purchase_cost(data,int(self.get_current_betmode().get_cost()))
        for event in data['events']:
            self.book.add_event(event)
        self.book.payout_multiplier = data['payoutMultiplier']/100
        self.book.basegame_wins = self.win_manager.basegame_wins = data['baseGameWins']
        self.book.freegame_wins = self.win_manager.freegame_wins = data['freeGameWins']
        self.win_manager.running_bet_win = data['payoutMultiplier']/100
        self.final_win = self.book.payout_multiplier
        self.imprint_wins()
    def run_freespin(self):
        raise RuntimeError('Feature generation is atomic inside model.generate().')
