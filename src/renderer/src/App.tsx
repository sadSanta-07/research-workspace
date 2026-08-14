import React, { useEffect, useState, FormEvent } from 'react'

interface Workspace {
  id: string
  name: string
  createdAt: string
}

function App(): JSX.Element {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null)

  useEffect(() => {
    const fetchWorkspaces = async (): Promise<void> => {
      const data = await window.api.getWorkspaces()
      setWorkspaces(data)
    }
    fetchWorkspaces()
  }, [])

  const handleCreateWorkspace = async (e: FormEvent): Promise<void> => {
    e.preventDefault()
    if (!newWorkspaceName.trim()) return

    const workspace = await window.api.createWorkspace(newWorkspaceName)
    setWorkspaces([...workspaces, workspace])
    setNewWorkspaceName('')
    setActiveWorkspace(workspace.id)
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
                    onClick={() => setActiveWorkspace(ws.id)}
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

        <section className="col-span-12 md:col-span-8">
          {activeWorkspace ? (
            <div className="bg-surface-dark text-text-inverse rounded-md min-h-[600px] flex flex-col items-center justify-center text-center p-[48px] overflow-hidden relative shadow-[rgba(0,0,0,0.22)_3px_5px_30px_0px]">
              <h1 className="mb-[16px] font-display text-[56px] tracking-[-0.02em]">
                Workspace Active.
              </h1>
              <p className="text-[21px] text-text-muted max-w-lg mb-[48px] leading-[1.3]">
                Your environment is fully isolated. Research, analyze, and build without boundaries.
              </p>
              <div className="flex gap-[16px]">
                <button className="button-secondary border-background-alt text-background-alt hover:bg-background-alt hover:text-surface-dark">
                  Import Document
                </button>
                <button className="button-primary">New Chat</button>
              </div>
            </div>
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
