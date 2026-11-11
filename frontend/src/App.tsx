import { Routes, Route, useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SupportButton } from "@/components/SupportButton";
import Home from "@/pages/Home";
import { AboutPage, PrivacyPage, TermsPage } from "@/pages/Info";
import { AuthCallback } from "@/screens/AuthCallback";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  // Read the fragment from useLocation() (reactive) — Google sign-in returns with #session_id=…
  const location = useLocation();
  return (
    <ErrorBoundary>
      <SupportButton />
      {location.hash.includes("session_id=") ? (
        <AuthCallback />
      ) : (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
        </Routes>
      )}
    </ErrorBoundary>
  );
}
