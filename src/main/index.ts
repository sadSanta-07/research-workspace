import { getDb, recoverInterruptedTasks } from './db'
import { ContextManager } from './contextManager'
import crypto from 'crypto'
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { MockProvider } from './ai'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  await recoverInterruptedTasks()

  const aiProvider = new MockProvider()
  const contextManager = new ContextManager()
  const activeGenerations = new Map<string, AbortController>()
  const mockDatabaseHistory: any[] = []

  ipcMain.handle('get-workspaces', async () => {
    const db = await getDb()
    return db.data.workspaces
  })

  ipcMain.handle('create-workspace', async (_, name: string) => {
    const db = await getDb()
    const newWorkspace = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString()
    }
    db.data.workspaces.push(newWorkspace)
    await db.write()
    return newWorkspace
  })

  ipcMain.on('start-chat', async (event, { prompt, conversationId }) => {
    const controller = new AbortController()
    activeGenerations.set(conversationId, controller)

    try {
      const contextPackage = contextManager.assembleContext(
        prompt,
        mockDatabaseHistory,
        'You are an expert AI research assistant. Provide concise, accurate answers.'
      )

      console.log(
        `Context built: ${contextPackage.tokensUsed} tokens. Budget exceeded (truncated older messages)? ${contextPackage.budgetExceeded}`
      )

      const promptWithContext = JSON.stringify(contextPackage.messages)

      const finalResponse = await aiProvider.streamChat(
        promptWithContext,
        (chunk) => {
          event.reply(`chat-chunk-${conversationId}`, chunk)
        },
        controller.signal
      )

      event.reply(`chat-complete-${conversationId}`, finalResponse)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      event.reply(`chat-error-${conversationId}`, errorMessage)
    } finally {
      activeGenerations.delete(conversationId)
    }
  })

  ipcMain.on('cancel-chat', (_, conversationId: string) => {
    const controller = activeGenerations.get(conversationId)
    if (controller) {
      controller.abort()
      activeGenerations.delete(conversationId)
    }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
