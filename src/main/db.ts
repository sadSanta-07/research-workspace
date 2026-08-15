import { JSONFilePreset } from 'lowdb/node'
import type { Low } from 'lowdb'
import { app } from 'electron'
import path from 'path'

export interface Workspace {
  id: string
  name: string
  createdAt: string
  instructions?: string
}

export interface Conversation {
  id: string
  workspaceId: string
  title: string
  model: string
  isPinned: boolean
  systemInstructions?: string
  createdAt: string
}

export interface Message {
  id: string
  conversationId: string
  workspaceId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

export interface DocumentRecord {
  id: string
  workspaceId: string
  name: string
  fileType: 'pdf' | 'md' | 'txt' | 'json'
  content: string
  status: 'processing' | 'ready' | 'failed'
  createdAt: string
}
export interface Task {
  id: string
  type: 'ai_generation'
  workspaceId: string
  prompt: string
  status: 'pending' | 'completed' | 'failed'
  createdAt: string
}

export interface TaskRecord {
  id: string
  workspaceId: string
  type: 'summarize' | 'compare' | 'extract' | 'report'
  status: 'Queued' | 'Running' | 'Completed' | 'Failed' | 'Cancelled'
  input: string
  result?: string
  error?: string
  createdAt: string
  updatedAt: string
}

export interface DatabaseSchema {
  workspaces: Workspace[]
  conversations: Conversation[]
  messages: ChatMessage[]
  documents: DocumentRecord[]
  tasks: Task[]
}
export interface ChatMessage {
  id: string
  workspaceId: string
  role: 'system' | 'user' | 'assistant'
  content: string
  createdAt: string
}

const defaultData: DatabaseSchema = {
  workspaces: [],
  conversations: [],
  messages: [],
  documents: [],
  tasks: []
}

const dbPath = path.join(app.getPath('userData'), 'workspace_db.json')

export async function getDb(): Promise<Low<DatabaseSchema>> {
  const db = await JSONFilePreset<DatabaseSchema>(dbPath, defaultData)
  return db
}

export async function addTask(workspaceId: string, prompt: string): Promise<string> {
  const db = await getDb()
  const taskId = crypto.randomUUID()
  db.data.tasks.push({
    id: taskId,
    type: 'ai_generation',
    workspaceId,
    prompt,
    status: 'pending',
    createdAt: new Date().toISOString()
  })
  await db.write()
  return taskId
}

export async function completeTask(taskId: string, status: 'completed' | 'failed'): Promise<void> {
  const db = await getDb()
  const task = db.data.tasks.find((t) => t.id === taskId)
  if (task) {
    task.status = status
    await db.write()
  }
}

export async function recoverInterruptedTasks(): Promise<void> {
  const db = await getDb()
  const pendingTasks = db.data.tasks.filter((t) => t.status === 'pending')

  if (pendingTasks.length === 0) return

  console.log(`Found ${pendingTasks.length} interrupted tasks. Recovering...`)

  for (const task of pendingTasks) {
    task.status = 'failed'

    db.data.messages.push({
      id: crypto.randomUUID(),
      workspaceId: task.workspaceId,
      role: 'system',
      content:
        'The previous generation was interrupted because the application closed. Please try again.',
      createdAt: new Date().toISOString()
    })
  }
  await db.write()
}
