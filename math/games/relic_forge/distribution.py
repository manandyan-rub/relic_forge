"""Integer-weight calibration with a budget for every capped outcome."""
import json
import math
from pathlib import Path

POLICY = json.loads(Path(__file__).with_name('distribution_policy.json').read_text())


def distribute_weight(books, budget):
    """Assign an exact integer mass, keeping every outcome selectable."""
    if not books or budget < len(books):
        raise RuntimeError('Insufficient positive integer weight budget')
    each, remainder = divmod(budget, len(books))
    return [(book, each + int(i < remainder)) for i, book in enumerate(books)]


def calibrate_bonus(books, forced_cap, cap_units):
    """Constrain the entire capped population before pricing and RTP fitting.

    Natural capped outcomes and the explicit example share one tail budget.
    Price from the tail-limited source mean, bounded by the cost policy, then
    solve low/high non-cap masses for the target return at the actual price.
    Outcome events and payouts are never rewritten by this calibration.
    """
    cap = cap_units / 100
    non_cap = [b for b in books if b['payoutMultiplier'] < cap_units]
    capped = [b for b in books if b['payoutMultiplier'] >= cap_units]
    if not non_cap or forced_cap['payoutMultiplier'] != cap_units:
        raise RuntimeError('A non-cap population and valid cap example are required')
    observed_tail = len(capped) / len(books)
    desired_tail = min(POLICY['maximumBonusCapProbability'],
                       max(POLICY['minimumBonusCapProbability'], observed_tail))
    budget = POLICY['integerWeightBudget']
    cap_budget = math.floor(desired_tail * budget)
    capped.append(forced_cap)
    if cap_budget < len(capped):
        raise RuntimeError('Cap probability budget cannot retain every outcome')
    tail = cap_budget / budget
    average = lambda items: sum(b['payoutMultiplier'] / 100 for b in items) / len(items)
    limited_mean = (1 - tail) * average(non_cap) + tail * cap
    unconstrained_cost = max(1, round(limited_mean / POLICY['targetRtp']))
    cost = min(POLICY['maximumBonusCostMultiplier'], unconstrained_cost)
    target = (POLICY['targetRtp'] * cost - tail * cap) / (1 - tail)
    low = [b for b in non_cap if b['payoutMultiplier'] / 100 <= target]
    high = [b for b in non_cap if b['payoutMultiplier'] / 100 > target]
    if not low or not high:
        raise RuntimeError('Available non-cap outcomes cannot meet the priced RTP')
    phigh = (target - average(low)) / (average(high) - average(low))
    if not 0 < phigh < 1:
        raise RuntimeError('Infeasible tail-constrained bonus pricing')
    remaining = budget - cap_budget
    high_budget = round(remaining * phigh)
    rows = (distribute_weight(low, remaining - high_budget)
            + distribute_weight(high, high_budget)
            + distribute_weight(capped, cap_budget))
    measured = sum(b['payoutMultiplier'] / 100 * w for b, w in rows) / budget / cost
    if abs(measured - POLICY['targetRtp']) >= 1e-7:
        raise RuntimeError('Rounded weights failed the RTP acceptance tolerance')
    details = dict(sourceCapProbability=observed_tail,
                   tailLimitedMeanPayoutBaseBetX=limited_mean,
                   unconstrainedCostMultiplier=unconstrained_cost,
                   costLimited=cost != unconstrained_cost,
                   distributionPolicy=POLICY['version'])
    return rows, cost, details
