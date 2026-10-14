
import { AskAI } from '@/utils/ai'
import { NextResponse } from 'next/server'
import { connection } from 'next/server'

export async function POST(request: Request) {
  await connection()
  const { ai, history, theme } = await request.json() // Parse incoming JSON body
  try{
    const result = await AskAI(ai, history, theme)
    console.log(result)
    return NextResponse.json({ 
      success: true,
      response: result
    })
  }catch(err){
    return NextResponse.json({ 
      success: false,
      message: err
    })
  }

}