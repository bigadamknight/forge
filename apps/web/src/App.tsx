import { Routes, Route } from 'react-router-dom'
import { InteractionProvider } from './lib/InteractionContext'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import NewWorkspacePage from './pages/NewWorkspacePage'
import InterviewPage from './pages/InterviewPage'
import DocumentUploadPage from './pages/DocumentUploadPage'
import WorkspacePage from './pages/WorkspacePage'
import ToolUserPage from './pages/ToolUserPage'

export default function App() {
  return (
    <InteractionProvider>
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/workspaces" element={<HomePage />} />
          <Route path="/workspace/new" element={<NewWorkspacePage />} />
          <Route path="/workspace/:workspaceId" element={<WorkspacePage />} />
          <Route path="/workspace/:workspaceId/interview/:forgeId" element={<InterviewPage />} />
          <Route path="/workspace/:workspaceId/documents" element={<DocumentUploadPage />} />
          <Route path="/tool/:workspaceId" element={<ToolUserPage />} />
        </Routes>
      </div>
    </InteractionProvider>
  )
}
