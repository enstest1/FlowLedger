import { redirect } from 'next/navigation'

// /intro now just sends you to sign-in which plays the intro automatically
export default function IntroPage() {
  redirect('/auth/signin')
}
