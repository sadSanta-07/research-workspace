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
    let mockResponse = `This is a simulated response to: "${prompt}". `

    if (toolRegistry) {
      const lowerPrompt = prompt.toLowerCase()

      if (lowerPrompt.includes('time') || lowerPrompt.includes('date')) {
        onChunk('[Running Tool: get_current_time...] \n\n')
        const timeResult = await toolRegistry.executeTool('get_current_time', {})
        mockResponse = `I checked the system clock. ${timeResult}`
      } else if (
        lowerPrompt.includes('+') ||
        lowerPrompt.includes('add') ||
        lowerPrompt.includes('calculate')
      ) {
        onChunk('[Running Tool: calculator...] \n\n')
        const result = await toolRegistry.executeTool('calculator', { expression: '5 + 5' })
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
