import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/HomePage'
import NewForgePage from './pages/NewForgePage'
import InterviewPage from './pages/InterviewPage'
import DocumentUploadPage from './pages/DocumentUploadPage'
import ToolViewPage from './pages/ToolViewPage'
import ToolUserPage from './pages/ToolUserPage'

export default function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/forges" element={<HomePage />} />
        <Route path="/forge/new" element={<NewForgePage />} />
        <Route path="/forge/:forgeId/interview" element={<InterviewPage />} />
        <Route path="/forge/:forgeId/documents" element={<DocumentUploadPage />} />
        <Route path="/forge/:forgeId/tool" element={<ToolViewPage />} />
        <Route path="/tool/:forgeId" element={<ToolUserPage />} />
      </Routes>
    </div>
  )
}
