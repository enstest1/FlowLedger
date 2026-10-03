import { SDK } from '@canton-network/wallet-sdk'
import { getCantonToken } from './canton-auth'

function requiredUrl(name: string): URL {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not set`)
  return new URL(value)
}

export async function createCantonWalletSdk() {
  const token = await getCantonToken()
  const auth = { method: 'static' as const, token }
  const ledgerClientUrl = requiredUrl('CANTON_LEDGER_URL')
  const registryUrl = requiredUrl('CANTON_TOKEN_REGISTRY_URL')

  return SDK.create({
    auth,
    ledgerClientUrl,
    token: {
      registries: [registryUrl],
      auth,
    },
  })
}

export function tokenRegistryUrl(): URL {
  return requiredUrl('CANTON_TOKEN_REGISTRY_URL')
}

export function instrumentIdFor(assetId: 'CC' | 'USDCX'): string {
  if (assetId === 'CC') return process.env.CANTON_CC_INSTRUMENT_ID?.trim() || 'Amulet'
  return process.env.CANTON_USDCX_INSTRUMENT_ID?.trim() || 'USDCx'
}

export async function listTokenUtxos(partyId: string, assetId?: 'CC' | 'USDCX') {
  const sdk = await createCantonWalletSdk()
  const utxos = await sdk.token.utxos.list({ partyId })
  if (!assetId) return utxos
  const instrumentId = instrumentIdFor(assetId)
  return utxos.filter((utxo) => utxo.interfaceViewValue.instrumentId.id === instrumentId)
}

export async function submitTokenTransfer(input: {
  sender: string
  recipient: string
  amount: string
  assetId: 'CC' | 'USDCX'
  memo?: string
}) {
  const sdk = await createCantonWalletSdk()
  const registryUrl = tokenRegistryUrl()
  const [commands, disclosedContracts] = await sdk.token.transfer.create({
    sender: input.sender,
    recipient: input.recipient,
    amount: input.amount,
    instrumentId: instrumentIdFor(input.assetId),
    registryUrl,
    memo: input.memo,
  })

  return sdk.ledger.internal.submit({
    actAs: [input.sender],
    commands: [commands],
    disclosedContracts,
  })
}
