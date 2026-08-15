import { getDb, recoverInterruptedTasks, addTask, completeTask } from './db'
import { ContextManager } from './contextManager'
import crypto from 'crypto'
import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { MockProvider } from './ai'
import { dialog } from 'electron'
import fs from 'fs/promises'
import { ToolRegistry } from './tools'

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
  const toolRegistry = new ToolRegistry()
  const activeGenerations = new Map<string, AbortController>()

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

  ipcMain.handle('get-messages', async (_, workspaceId: string) => {
    const db = await getDb()
    return db.data.messages.filter((m) => m.workspaceId === workspaceId)
  })

  ipcMain.handle('save-message', async (_, message: any) => {
    const db = await getDb()
    db.data.messages.push(message)
    await db.write()
    return message
  })

  ipcMain.handle('import-document', async (event, workspaceId: string) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Text & Markdown', extensions: ['txt', 'md'] }]
    })

    if (canceled || filePaths.length === 0) return null

    const filePath = filePaths[0]
    const content = await fs.readFile(filePath, 'utf-8')

    const name = filePath.replace(/^.*[\\/]/, '')

    const db = await getDb()
    const newDoc = {
      id: crypto.randomUUID(),
      workspaceId,
      name,
      content,
      createdAt: new Date().toISOString()
    }
    db.data.documents.push(newDoc)
    await db.write()

    return newDoc
  })

  ipcMain.handle('get-documents', async (_, workspaceId: string) => {
    const db = await getDb()
    return db.data.documents.filter((d) => d.workspaceId === workspaceId)
  })

  ipcMain.handle('start-background-job', async (event, { workspaceId, documentId, type }) => {
    const db = await getDb()
    const doc = db.data.documents.find((d) => d.id === documentId)
    if (!doc) throw new Error('Document not found')

    const newJob = {
      id: crypto.randomUUID(),
      workspaceId,
      type,
      status: 'Queued' as const,
      input: doc.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    db.data.tasks.push(newJob as any)
    await db.write()

    runBackgroundJob(newJob.id, doc.content, type)

    return newJob
  })

  ipcMain.handle('get-background-jobs', async (_, workspaceId: string) => {
    const db = await getDb()
    return db.data.tasks.filter(
      (t: any) => t.workspaceId === workspaceId && (t.type === 'summarize' || t.type === 'extract')
    )
  })

  async function runBackgroundJob(jobId: string, content: string, type: string) {
    let db = await getDb()
    let job = db.data.tasks.find((t) => t.id === jobId) as any
    if (!job) return

    job.status = 'Running'
    job.updatedAt = new Date().toISOString()
    await db.write()

    try {
      await new Promise((resolve) => setTimeout(resolve, 5000))

      if (type === 'summarize') {
        job.result = `Summary complete: The document discusses various technical concepts. Total length processed: ${content.length} characters.`
      } else if (type === 'extract') {
        job.result = `Key Insights:\n1. Architecture scales well.\n2. Persistence is local.\n3. Extensibility requires clean interfaces.`
      }

      job.status = 'Completed'
    } catch (error) {
      job.status = 'Failed'
      job.error = String(error)
    } finally {
      job.updatedAt = new Date().toISOString()
      db = await getDb()
      const currentJob = db.data.tasks.find((t) => t.id === jobId) as any
      if (currentJob) {
        currentJob.status = job.status
        currentJob.result = job.result
        currentJob.error = job.error
        currentJob.updatedAt = job.updatedAt
        await db.write()
      }
    }
  }

  ipcMain.on('start-chat', async (event, { prompt, conversationId }) => {
    const controller = new AbortController()
    activeGenerations.set(conversationId, controller)

    const taskId = await addTask(conversationId, prompt)

    try {
      const db = await getDb()

      const realHistory = db.data.messages
        .filter((m) => m.workspaceId === conversationId)
        .map((m) => ({ role: m.role, content: m.content }))
      realHistory.pop()

      const workspaceDocs = db.data.documents.filter((d) => d.workspaceId === conversationId)
      const documentExcerpts =
        workspaceDocs.length > 0
          ? workspaceDocs.map((d) => `--- Document: ${d.name} ---\n${d.content}`).join('\n\n')
          : undefined

      const contextPackage = contextManager.assembleContext(
        prompt,
        realHistory,
        'You are an expert AI research assistant. Provide concise, accurate answers.',
        documentExcerpts
      )

      const promptWithContext = JSON.stringify(contextPackage.messages)

      const finalResponse = await aiProvider.streamChat(
        promptWithContext,
        (chunk) => {
          event.reply(`chat-chunk-${conversationId}`, chunk)
        },
        controller.signal,
        toolRegistry
      )

      event.reply(`chat-complete-${conversationId}`, finalResponse)

      await completeTask(taskId, 'completed')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      event.reply(`chat-error-${conversationId}`, errorMessage)

      await completeTask(taskId, 'failed')
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
