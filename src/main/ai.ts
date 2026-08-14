/* eslint-disable prettier/prettier */
export interface AIProvider {
  name: string
  streamChat(prompt: string, onChunk: (chunk: string) => void, signal: AbortSignal): Promise<string>
}

export class MockProvider implements AIProvider {
  name = 'Mock Local Model'

  async streamChat(
    prompt: string,
    onChunk: (chunk: string) => void,
    signal: AbortSignal
  ): Promise<string> {
    const mockResponse = `This is a simulated response to: "${prompt}".\n\nIn a real scenario, this text would stream from a live API. We are testing the streaming lifecycle, including partial outputs and cancellation.`
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
          const chunk = words[i] + ' '
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
