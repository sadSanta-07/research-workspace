import { useEffect, useState, FormEvent } from 'react'

interface Workspace {
  id: string
  name: string
  createdAt: string
}
interface ChatMessage {
  id: string
  workspaceId: string
  role: 'system' | 'user' | 'assistant'
  content: string
  createdAt: string
}

function App(): React.ReactElement {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [backgroundJobs, setBackgroundJobs] = useState<any[]>([])

  useEffect(() => {
    const fetchWorkspaces = async (): Promise<void> => {
      const data = await window.api.getWorkspaces()
      setWorkspaces(data)
    }
    fetchWorkspaces()
  }, [])

  const handleSelectWorkspace = async (workspaceId: string): Promise<void> => {
    if (isStreaming && activeChatId) {
      window.api.cancelChat(activeChatId)
    }

    setActiveWorkspace(workspaceId)
    setActiveChatId(workspaceId)
    setInputValue('')
    setIsStreaming(false)

    const history = await window.api.getMessages(workspaceId)
    setMessages(history)

    const docs = await window.api.getDocuments(workspaceId)
    setDocuments(docs)

    const jobs = await window.api.getBackgroundJobs(workspaceId)
    setBackgroundJobs(jobs)
  }

  useEffect(() => {
    let interval: NodeJS.Timeout
    const hasRunningJobs = backgroundJobs.some(
      (job) => job.status === 'Running' || job.status === 'Queued'
    )

    if (activeWorkspace && hasRunningJobs) {
      interval = setInterval(async () => {
        const updatedJobs = await window.api.getBackgroundJobs(activeWorkspace)
        setBackgroundJobs(updatedJobs)
      }, 2000)
    }
    return () => clearInterval(interval)
  }, [activeWorkspace, backgroundJobs])

  const handleImportDocument = async (): Promise<void> => {
    if (!activeWorkspace) return
    const newDoc = await window.api.importDocument(activeWorkspace)
    if (newDoc) {
      setDocuments((prev) => [...prev, newDoc])
    }
  }

  const handleCreateWorkspace = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newWorkspaceName.trim()) return

    const workspace = await window.api.createWorkspace(newWorkspaceName)
    setWorkspaces([...workspaces, workspace])
    setNewWorkspaceName('')

    handleSelectWorkspace(workspace.id)
  }

  const handleSendMessage = async (e?: React.FormEvent): Promise<void> => {
    if (e) e.preventDefault()
    if (!inputValue.trim() || isStreaming || !activeWorkspace) return

    const chatId = activeWorkspace

    const newUserMessage: ChatMessage = {
      id: crypto.randomUUID(),
      workspaceId: activeWorkspace,
      role: 'user',
      content: inputValue,
      createdAt: new Date().toISOString()
    }

    const newAssistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      workspaceId: activeWorkspace,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString()
    }

    await window.api.saveMessage(newUserMessage)

    setMessages((prev) => [...prev, newUserMessage, newAssistantMessage])
    setInputValue('')
    setIsStreaming(true)

    window.api.onChatChunk(chatId, (chunk) => {
      setMessages((prev) => {
        const updated = [...prev]
        const lastIndex = updated.length - 1
        updated[lastIndex] = {
          ...updated[lastIndex],
          content: updated[lastIndex].content + chunk
        }
        return updated
      })
    })

    window.api.onChatComplete(chatId, async (fullText) => {
      setIsStreaming(false)
      window.api.removeChatListeners(chatId)

      const finalAssistantMessage = { ...newAssistantMessage, content: fullText }
      await window.api.saveMessage(finalAssistantMessage)
    })

    window.api.onChatError(chatId, (error) => {
      setIsStreaming(false)
      console.error('Chat Error:', error)
      window.api.removeChatListeners(chatId)
    })

    window.api.startChat(inputValue, chatId)
  }

  const handleCancel = (): void => {
    if (activeChatId && isStreaming) {
      window.api.cancelChat(activeChatId)
      setIsStreaming(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-text text-text-primary">
      <nav className="global-nav">
        <div className="flex items-center">
          <span className="font-text text-[14px] font-semibold tracking-tight">
            AI Research Workspace
          </span>
        </div>
        <div>
          <button className="nav-link">Settings</button>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-[1068px] mx-auto px-4 py-[48px] grid grid-cols-12 gap-[32px]">
        <aside className="col-span-12 md:col-span-4 flex flex-col gap-[24px]">
          <div className="card px-[32px] py-[32px]">
            <h3 className="mb-[24px]">Workspaces</h3>

            <div className="flex flex-col gap-[8px] mb-[32px]">
              {workspaces.length === 0 ? (
                <p className="text-[14px] text-text-muted">No workspaces found.</p>
              ) : (
                workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => handleSelectWorkspace(ws.id)}
                    className={`text-left px-4 py-3 rounded-md text-[17px] transition-colors duration-[320ms] ${
                      activeWorkspace === ws.id
                        ? 'bg-primary text-background-alt'
                        : 'text-text-primary hover:bg-background'
                    }`}
                  >
                    {ws.name}
                  </button>
                ))
              )}
            </div>

            <form
              onSubmit={handleCreateWorkspace}
              className="flex flex-col gap-[16px] pt-[24px] border-t border-border"
            >
              <div>
                <label className="form-label">New Workspace</label>
                <input
                  type="text"
                  placeholder="Workspace Name"
                  className="text-input"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                />
              </div>
              <button type="submit" className="button-primary w-full text-[14px] py-2">
                Create
              </button>
            </form>
          </div>
        </aside>

        <section className="col-span-12 md:col-span-8 flex flex-col gap-[24px]">
          {activeWorkspace ? (
            <>
              {(documents.length > 0 || backgroundJobs.length > 0) && (
                <div className="card p-[24px]">
                  {documents.length > 0 && (
                    <div className="mb-[16px]">
                      <h3 className="text-[14px] font-bold text-text-muted mb-[12px]">
                        Workspace Documents
                      </h3>
                      <div className="flex flex-col gap-[8px]">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between bg-background p-[12px] rounded-md border border-border"
                          >
                            <span className="text-[14px] font-medium">{doc.name}</span>
                            <div className="flex gap-[8px]">
                              <button
                                onClick={async () => {
                                  await window.api.startBackgroundJob({
                                    workspaceId: activeWorkspace,
                                    documentId: doc.id,
                                    type: 'summarize'
                                  })
                                  const jobs = await window.api.getBackgroundJobs(activeWorkspace)
                                  setBackgroundJobs(jobs)
                                }}
                                className="button-secondary text-[12px] px-[8px] py-[4px]"
                              >
                                Summarize
                              </button>
                              <button
                                onClick={async () => {
                                  await window.api.startBackgroundJob({
                                    workspaceId: activeWorkspace,
                                    documentId: doc.id,
                                    type: 'extract'
                                  })
                                  const jobs = await window.api.getBackgroundJobs(activeWorkspace)
                                  setBackgroundJobs(jobs)
                                }}
                                className="button-secondary text-[12px] px-[8px] py-[4px]"
                              >
                                Extract Insights
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {backgroundJobs.length > 0 && (
                    <div
                      className={`${documents.length > 0 ? 'pt-[16px] border-t border-border' : ''}`}
                    >
                      <h3 className="text-[14px] font-bold text-text-muted mb-[12px]">
                        Background Jobs
                      </h3>
                      {backgroundJobs.map((job) => (
                        <div
                          key={job.id}
                          className="text-[13px] mb-[8px] p-[12px] bg-background rounded-md border border-border"
                        >
                          <div className="flex justify-between mb-[4px]">
                            <strong className="font-semibold">
                              {job.type === 'summarize' ? 'Summary' : 'Extraction'}
                            </strong>
                            <span
                              className={`font-medium ${job.status === 'Running' ? 'text-blue-500 animate-pulse' : job.status === 'Completed' ? 'text-green-500' : 'text-text-muted'}`}
                            >
                              {job.status}
                            </span>
                          </div>
                          {job.result && (
                            <div className="text-text-muted mt-[8px] border-t border-border pt-[8px]">
                              {job.result}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="card flex-1 flex flex-col gap-[24px] min-h-[500px] max-h-[600px] overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center">
                    <h2 className="text-text-primary mb-[8px] text-[28px]">Research Assistant</h2>
                    <p className="text-[17px] text-text-muted">
                      Ask a question or import a document to begin.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[12px] text-text-muted mb-[4px] px-[12px]">
                        {msg.role === 'user'
                          ? 'You'
                          : msg.role === 'system'
                            ? 'System Alert'
                            : 'Assistant'}
                      </span>
                      <div
                        className={`px-[20px] py-[12px] rounded-md max-w-[80%] text-[17px] leading-[1.4] ${
                          msg.role === 'user'
                            ? 'bg-primary text-background-alt'
                            : msg.role === 'system'
                              ? 'bg-red-500/10 text-red-600 border border-red-500/20 font-medium'
                              : 'bg-background text-text-primary'
                        }`}
                      >
                        {msg.content}
                        {isStreaming && msg.role === 'assistant' && msg.content === '' && (
                          <span className="animate-pulse">...</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="card p-[24px]">
                <form onSubmit={handleSendMessage} className="flex gap-[16px]">
                  <button
                    type="button"
                    onClick={handleImportDocument}
                    className="button-secondary px-[16px] text-[14px]"
                    title="Import Text or Markdown Document"
                  >
                    + Doc
                  </button>
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Ask a question..."
                    className="text-input flex-1"
                    disabled={isStreaming}
                  />
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="button-secondary text-[14px]"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="button-primary text-[14px]"
                      disabled={!inputValue.trim()}
                    >
                      Send
                    </button>
                  )}
                </form>
              </div>
            </>
          ) : (
            <div className="card min-h-[600px] flex flex-col items-center justify-center text-center">
              <h2 className="text-text-muted mb-4">Start your research.</h2>
              <p className="text-[17px] text-text-muted">
                Select a workspace from the sidebar to begin.
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
