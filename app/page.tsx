import HomeClient from '@/components/HomeClient'
import { AVAILABLE_MODELS } from '@/utils/ai'

export default function Home() {
  return <HomeClient availableModels={AVAILABLE_MODELS} />
}
