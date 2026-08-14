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
  messages: Message[]
  documents: DocumentRecord[]
  tasks: TaskRecord[]
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

export async function recoverInterruptedTasks(): Promise<void> {
  const db = await getDb()
  let modified = false

  for (const task of db.data.tasks) {
    if (task.status === 'Running' || task.status === 'Queued') {
      task.status = 'Failed'
      task.error = 'Application closed unexpectedly before task completion.'
      task.updatedAt = new Date().toISOString()
      modified = true
    }
  }

  if (modified) {
    await db.write()
  }
}
