/* eslint-disable prettier/prettier */
export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ContextPackage {
  messages: Message[]
  tokensUsed: number
  budgetExceeded: boolean
}

export class ContextManager {
  private readonly CHARS_PER_TOKEN = 4
  private readonly MAX_CONTEXT_TOKENS = 4096
  private readonly RESERVED_OUTPUT_TOKENS = 1000

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / this.CHARS_PER_TOKEN)
  }

  public assembleContext(
    newPrompt: string,
    history: Message[],
    systemInstructions?: string,
    documentExcerpts?: string
  ): ContextPackage {
    const availableTokens = this.MAX_CONTEXT_TOKENS - this.RESERVED_OUTPUT_TOKENS
    let currentTokens = 0
    const finalMessages: Message[] = []
    let budgetExceeded = false

    if (systemInstructions) {
      currentTokens += this.estimateTokens(systemInstructions)
      finalMessages.push({ role: 'system', content: systemInstructions })
    }

    if (documentExcerpts) {
      const docContext = `Reference Document Context:\n${documentExcerpts}`
      currentTokens += this.estimateTokens(docContext)
      finalMessages.push({ role: 'system', content: docContext })
    }

    const newPromptTokens = this.estimateTokens(newPrompt)
    currentTokens += newPromptTokens

    const historyToAdd: Message[] = []
    for (let i = history.length - 1; i >= 0; i--) {
      const msgTokens = this.estimateTokens(history[i].content)
      if (currentTokens + msgTokens <= availableTokens) {
        historyToAdd.unshift(history[i])
        currentTokens += msgTokens
      } else {
        budgetExceeded = true
        break
      }
    }

    finalMessages.push(...historyToAdd)
    finalMessages.push({ role: 'user', content: newPrompt })

    return {
      messages: finalMessages,
      tokensUsed: currentTokens,
      budgetExceeded
    }
  }
}
