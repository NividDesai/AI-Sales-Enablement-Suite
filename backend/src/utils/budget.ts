import { config } from '../config'

export class Budget {
  private spent = 0
  private readonly limit = Math.max(0, config.runBudgetUsd)

  canSpend(cost: number): boolean {
    return this.spent + cost <= this.limit
  }

  spend(cost: number) {
    this.spent += cost
  }

  remaining(): number {
    return Math.max(0, this.limit - this.spent)
  }
}

export function costOf(key: keyof typeof config.providerUnitCosts): number {
  return config.providerUnitCosts[key] ?? 0
}


