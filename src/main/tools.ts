/* eslint-disable prettier/prettier */
export interface AITool {
  name: string
  description: string
  parameters: Record<string, any>
  execute: (args: any) => Promise<string>
}

const calculatorTool: AITool = {
  name: 'calculator',
  description: 'Evaluates basic mathematical expressions. Use this to answer math questions.',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'The math expression to evaluate, e.g., "2 + 2 * 5"'
      }
    },
    required: ['expression']
  },
  execute: async (args: { expression: string }) => {
    try {
      const sanitized = args.expression.replace(/[^0-9+\-*/(). ]/g, '')
      const result = eval(sanitized)
      return `Result: ${result}`
    } catch (error) {
      return `Error evaluating expression: ${args.expression}`
    }
  }
}

const dateTimeTool: AITool = {
  name: 'get_current_time',
  description: 'Returns the current local date and time.',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  },
  execute: async () => {
    return `The current date and time is: ${new Date().toLocaleString()}`
  }
}

const jsonFormatterTool: AITool = {
  name: 'json_formatter',
  description: 'Formats a raw JSON string into a pretty-printed, readable JSON block.',
  parameters: {
    type: 'object',
    properties: {
      rawJson: { type: 'string', description: 'The unformatted JSON string' }
    },
    required: ['rawJson']
  },
  execute: async (args: { rawJson: string }) => {
    try {
      const parsed = JSON.parse(args.rawJson)
      return JSON.stringify(parsed, null, 2)
    } catch (error) {
      return 'Error: Invalid JSON provided.'
    }
  }
}

export class ToolRegistry {
  private tools: Map<string, AITool> = new Map()

  constructor() {
    this.registerTool(calculatorTool)
    this.registerTool(dateTimeTool)
    this.registerTool(jsonFormatterTool)
  }

  public registerTool(tool: AITool) {
    this.tools.set(tool.name, tool)
  }

  public getAvailableTools(): AITool[] {
    return Array.from(this.tools.values())
  }

  public async executeTool(toolName: string, args: any): Promise<string> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      throw new Error(`Tool ${toolName} not found.`)
    }
    console.log(`[Tool Execution] Running ${toolName} with args:`, args)
    return await tool.execute(args)
  }
}
