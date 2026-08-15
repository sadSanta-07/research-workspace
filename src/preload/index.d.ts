/* eslint-disable prettier/prettier */
import { ElectronAPI } from '@electron-toolkit/preload'
import { Workspace } from '../main/db'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getWorkspaces: () => Promise<Workspace[]>
      createWorkspace: (name: string) => Promise<Workspace>
      startChat: (prompt: string, conversationId: string) => void
      cancelChat: (conversationId: string) => void
      onChatChunk: (conversationId: string, callback: (chunk: string) => void) => void
      onChatComplete: (conversationId: string, callback: (fullText: string) => void) => void
      onChatError: (conversationId: string, callback: (error: string) => void) => void
      removeChatListeners: (conversationId: string) => void
      getMessages: (workspaceId: string) => Promise<any[]>
      saveMessage: (message: any) => Promise<any>
      importDocument: (workspaceId: string) => Promise<any>
      getDocuments: (workspaceId: string) => Promise<any[]>
      startBackgroundJob: (args: { workspaceId: string, documentId: string, type: string }) => Promise<any>
      getBackgroundJobs: (workspaceId: string) => Promise<any[]>
    }
  }
}
