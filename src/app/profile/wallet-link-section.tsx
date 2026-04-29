'use client'

import { useRouter } from 'next/navigation'
import { CantonWalletConnect } from '@/components/canton-wallet-connect'
import { linkCantonWallet } from '@/app/actions/user'
import { toast } from 'sonner'

export function WalletLinkSection() {
  const router = useRouter()

  async function handleSuccess(partyId: string) {
    const result = await linkCantonWallet(partyId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Canton wallet connected')
      router.refresh()
    }
  }

  return <CantonWalletConnect linkOnly onSuccess={handleSuccess} />
}
