import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  getWorkspaces: () => ipcRenderer.invoke('get-workspaces'),
  createWorkspace: (name: string) => ipcRenderer.invoke('create-workspace', name),
  getMessages: (workspaceId: string) => ipcRenderer.invoke('get-messages', workspaceId),
  saveMessage: (message: any) => ipcRenderer.invoke('save-message', message),

  startChat: (prompt: string, conversationId: string) =>
    ipcRenderer.send('start-chat', { prompt, conversationId }),
  cancelChat: (conversationId: string) => ipcRenderer.send('cancel-chat', conversationId),
  onChatChunk: (conversationId: string, callback: (chunk: string) => void) => {
    ipcRenderer.on(`chat-chunk-${conversationId}`, (_event, chunk) => callback(chunk))
  },
  onChatComplete: (conversationId: string, callback: (fullText: string) => void) => {
    ipcRenderer.once(`chat-complete-${conversationId}`, (_event, fullText) => callback(fullText))
  },
  onChatError: (conversationId: string, callback: (error: string) => void) => {
    ipcRenderer.once(`chat-error-${conversationId}`, (_event, error) => callback(error))
  },
  removeChatListeners: (conversationId: string) => {
    ipcRenderer.removeAllListeners(`chat-chunk-${conversationId}`)
    ipcRenderer.removeAllListeners(`chat-complete-${conversationId}`)
    ipcRenderer.removeAllListeners(`chat-error-${conversationId}`)
  }
}
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
