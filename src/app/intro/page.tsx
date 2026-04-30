'use client'
import { useRouter } from 'next/navigation'
import { IntroAnimation } from '@/components/intro/intro-animation'

export default function IntroPage() {
  const router = useRouter()
  const go = () => router.push('/auth/signin')
  return <IntroAnimation onComplete={go} onSkip={go}/>
}
