import { expect, test, describe } from 'vitest'
import { ToolRegistry } from './tools'

describe('ToolRegistry Architecture', () => {
  const registry = new ToolRegistry()

  test('Should load all default tools on initialization', () => {
    const tools = registry.getAvailableTools()
    expect(tools.length).toBe(3)
    expect(tools.map((t) => t.name)).toContain('calculator')
    expect(tools.map((t) => t.name)).toContain('get_current_time')
    expect(tools.map((t) => t.name)).toContain('json_formatter')
  })

  test('Calculator tool correctly evaluates clean math expressions', async () => {
    const result = await registry.executeTool('calculator', { expression: '5 + 5 * 2' })
    expect(result).toBe('Result: 15')
  })

  test('Calculator tool securely handles malicious code (Argument Validation)', async () => {
    const result = await registry.executeTool('calculator', {
      expression: '5 + 5; console.log("hack"); process.exit(1);'
    })
    expect(result).toBe('Error evaluating expression: 5 + 5; console.log("hack"); process.exit(1);')
  })

  test('JSON Formatter gracefully handles invalid JSON strings', async () => {
    const result = await registry.executeTool('json_formatter', { rawJson: '{ bad_json: true ' })
    expect(result).toBe('Error: Invalid JSON provided.')
  })

  test('Throws a clear error when an unregistered tool is called', async () => {
    await expect(registry.executeTool('hallucinated_tool', {})).rejects.toThrow(
      'Tool hallucinated_tool not found.'
    )
  })
})
