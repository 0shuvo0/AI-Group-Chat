'use client'

import { useEffect, useState } from 'react'
import RenderChat from '@/components/RenderChat'
import ThemeInputModal from './ThemeInputModal'
import type { AI_MODEL } from '@/utils/models'
import { ai_members } from '@/utils/models'

const MAX_HISTORY = 20


type Message = {
  name: AI_MODEL
  time: string
  messages: string[]
}

type HomeClientProps = {
  availableModels: AI_MODEL[]
}

const MESSAGES_DELAY = 300



const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function HomeClient({ availableModels }: HomeClientProps) {
  const members = ai_members.filter((member) =>
    availableModels.includes(member.name),
  )

  const [theme, setTheme] = useState<string | null>()
  const [stopped, setStopped] = useState(true)
  const [forceStop, setForceStop] = useState(false)

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

        await delay(2000)
        setStopped(false)
      }else{
        setStopped(false)
      }
    }catch(err){
      console.error(err)
      setStopped(true)
    }finally{
      setCurrentlyTyping(null)
    }
  }

  useEffect(() => {
    if(stopped || forceStop) return
    getMessage()
  }, [stopped, renderingMessages])

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
      />

      <button
       className='stop-btn'
       onClick={() => {
        setForceStop(true);
        setCurrentlyTyping(null)
       }}
      >
        &#x23F9;
      </button>

      { renderingMessages && (<button
       className='stop-btn'
       style={{bottom: '150px'}}
      >
        ⚙️
      </button> )}
    </div>
  )
}
