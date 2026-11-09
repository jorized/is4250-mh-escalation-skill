import { useState } from "react";
import { Chat } from "./components/Chat";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Gate, type Credentials } from "./components/Gate";

export default function App() {
  const [creds, setCreds] = useState<Credentials | null>(null);
  return (
    <ErrorBoundary>
      {creds ? <Chat creds={creds} onSignOut={() => setCreds(null)} /> : <Gate onReady={setCreds} />}
    </ErrorBoundary>
  );
}
