/* eslint-disable prettier/prettier */
import { ToolRegistry } from './tools'
export interface AIProvider {
  name: string
  streamChat(
    prompt: string,
    onChunk: (chunk: string) => void,
    signal: AbortSignal,
    toolRegistry?: ToolRegistry
  ): Promise<string>
}

export class MockProvider implements AIProvider {
  name = 'Mock Local Model'

  async streamChat(
    prompt: string,
    onChunk: (chunk: string) => void,
    signal: AbortSignal,
    toolRegistry?: ToolRegistry
  ): Promise<string> {

    let latestUserMessage = prompt
    try {
      const messages = JSON.parse(prompt)
      if (Array.isArray(messages) && messages.length > 0) {
        latestUserMessage = messages[messages.length - 1].content
      }
    } catch (e) {
      // If it fails to parse, it just falls back to using the raw prompt
    }
    let mockResponse = `This is a simulated response to: "${latestUserMessage}". `

    if (toolRegistry) {
      const lowerPrompt = latestUserMessage.toLowerCase()

      if (lowerPrompt.includes('time') || lowerPrompt.includes('date')) {
        onChunk('[Running Tool: get_current_time...] \n\n')
        const timeResult = await toolRegistry.executeTool('get_current_time', {})
        mockResponse = `I checked the system clock. ${timeResult}`
      }

      else if (lowerPrompt.includes('+') || lowerPrompt.includes('-') || lowerPrompt.includes('*') || lowerPrompt.includes('/')) {
        onChunk('[Running Tool: calculator...] \n\n')
        const mathMatch = latestUserMessage.match(/[0-9]+[ \t]*[+\-*/][ \t]*[0-9]+/)
        const expressionToSolve = mathMatch ? mathMatch[0] : '0 + 0'
        const result = await toolRegistry.executeTool('calculator', { expression: expressionToSolve })
        mockResponse = `I calculated that for you. ${result}`
      }
    }

    const words = mockResponse.split(' ')
    let fullText = ''

    return new Promise((resolve, reject) => {
      let i = 0
      const interval = setInterval(() => {
        if (signal.aborted) {
          clearInterval(interval)
          reject(new Error('AbortError: Generation cancelled by user'))
          return
        }

        if (i < words.length) {
          const chunk = words[i] + (i === words.length - 1 ? '' : ' ')
          fullText += chunk
          onChunk(chunk)
          i++
        } else {
          clearInterval(interval)
          resolve(fullText)
        }
      }, 100)

      signal.addEventListener('abort', () => {
        clearInterval(interval)
        reject(new Error('AbortError: Generation cancelled by user'))
      })
    })
  }
}
