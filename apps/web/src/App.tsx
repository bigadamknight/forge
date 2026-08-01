import { Routes, Route } from 'react-router-dom'
import { InteractionProvider } from './lib/InteractionContext'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import NewWorkspacePage from './pages/NewWorkspacePage'
import InterviewPage from './pages/InterviewPage'
import DocumentUploadPage from './pages/DocumentUploadPage'
import WorkspacePage from './pages/WorkspacePage'
import ToolUserPage from './pages/ToolUserPage'
import LearnerOnboardingPage from './pages/LearnerOnboardingPage'
import PathPage from './pages/PathPage'
import SessionPage from './pages/SessionPage'

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
          <Route path="/learn/:workspaceId" element={<PathPage />} />
          <Route path="/learn/:workspaceId/onboard" element={<LearnerOnboardingPage />} />
          <Route path="/learn/:workspaceId/session" element={<SessionPage />} />
        </Routes>
      </div>
    </InteractionProvider>
  )
}
