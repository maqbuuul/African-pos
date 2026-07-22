import type { TaxAdapter } from './tax-adapter.interface.js'
import { KraEtimesAdapter } from './adapters/kra-etims.adapter.js'

const adapters = new Map<string, TaxAdapter>()

export const getTaxAdapter = (provider: string): TaxAdapter => {
  let adapter = adapters.get(provider)
  if (adapter) return adapter

  switch (provider) {
    case 'kra_etims':
      adapter = new KraEtimesAdapter()
      break
    default:
      throw new Error(`Unknown tax provider: ${provider}`)
  }

  adapters.set(provider, adapter)
  return adapter
}
