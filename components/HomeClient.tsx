'use client'

import { useEffect, useState } from 'react'
import RenderChat from '@/components/RenderChat'
import ThemeInputModal from './ThemeInputModal'
import type { AI_MODEL } from '@/utils/models'
import { ai_members } from '@/utils/models'

const MAX_HISTORY = 20
const NEXT_MESSAGE_DELAY = 1000
const MESSAGES_DELAY = 600


type Message = {
  name: AI_MODEL
  time: string
  messages: string[]
}

type HomeClientProps = {
  availableModels: AI_MODEL[]
}



const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function HomeClient({ availableModels }: HomeClientProps) {
  const members = ai_members.filter((member) =>
    availableModels.includes(member.name),
  )

  const [theme, setTheme] = useState<string | null>()
  const [stopped, setStopped] = useState(true)
  const [forceStop, setForceStop] = useState(false)
  const [TTSAILoaded, setTTSAILoaded] = useState(false)

  const [messages, setMessages] = useState<Message[]>([])
  const [currentlyTyping, setCurrentlyTyping] = useState<string | null>(null)

  const [renderingMessages, setRenderingMessages] = useState(false)

  const [count, setCount] = useState<number>(0)
  async function getMessage() {
    if(forceStop) return

    const current = members[count % members.length]
    setCurrentlyTyping(current.name)
    
    try{
      setStopped(true)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json' // 2. Tell the server you're sending JSON
        },
        body: JSON.stringify({
          ai: current.name,
          theme: theme,
          history: messages.slice(-MAX_HISTORY).map(m => `${m.name}: ${m.messages.join('\n')}`).join('\n')
        })
      })

      const data = await res.json()
      if(!data.success){
        return console.error(data.message || 'Something went wrong')
      }

      setCount(c => c + 1)
      if(data.response && data.response.length){
        setMessages(prev => [...prev, {
          name: current.name,
          messages: data.response || [],
          time: (new Date()).toISOString()
        }])

      }
      setStopped(false)
      
    }catch(err){
      console.error(err)
      setStopped(true)
    }finally{
      setCurrentlyTyping(null)
    }
  }

  useEffect(() => {
    if (stopped || forceStop || !TTSAILoaded || renderingMessages) return

    // wait a bit after the last bubble finished, then ask for the next message
    const timer = setTimeout(getMessage, NEXT_MESSAGE_DELAY)
    return () => clearTimeout(timer)
  }, [stopped, forceStop, TTSAILoaded, renderingMessages])

  useEffect(() => {
    console.log("renderingMessages: " + renderingMessages)
  }, [renderingMessages])


  return (
    <div style={{ height: '100dvh' }}>
      <ThemeInputModal
        onDismiss={text => {
          setTheme(text);
          setStopped(false)
        }}
      />
      <RenderChat
        members={members}
        messages={messages}
        currentlyTyping={currentlyTyping}
        messageSound="/sound/message.wav"
        messageDelay={MESSAGES_DELAY}
        onLoadingStateChange={setRenderingMessages}
        onTTSAILoaded={() => setTTSAILoaded(true)}
        ttsDevice={hasWebGPU ? 'webgpu' : 'wasm'}
        ttsDtype={hasWebGPU ? 'fp32' : 'q8'}
      />

      <button
       className='stop-btn'
       onClick={() => {
        setForceStop(p => !p);
        setCurrentlyTyping(null)
       }}
      >
        {forceStop ? '▶' : '⏹'}
      </button>
    </div>
  )
}
