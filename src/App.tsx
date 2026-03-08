import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";

import UserManagement from "./pages/UserManagement";
import Zones from "./pages/Zones";
import AuditLogs from "./pages/AuditLogs";
import AllRequests from "./pages/AllRequests";
import Settings from "./pages/Settings";
import CreateRequest from "./pages/CreateRequest";
import EditRequest from "./pages/EditRequest";
import MyRequests from "./pages/MyRequests";
import PendingApprovals from "./pages/PendingApprovals";
import ApprovalHistory from "./pages/ApprovalHistory";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/dashboard" element={<Navigate to="/my-requests" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            

            <Route path="/users" element={<UserManagement />} />
            <Route path="/zones" element={<Zones />} />
            <Route path="/all-requests" element={<AllRequests />} />
            <Route path="/audit-logs" element={<AuditLogs />} />
            <Route path="/settings" element={<Settings />} />

            <Route path="/my-requests" element={<MyRequests />} />
            <Route path="/create-request" element={<CreateRequest />} />
            <Route path="/edit-request/:id" element={<EditRequest />} />

            <Route path="/pending-approvals" element={<PendingApprovals />} />
            <Route path="/approval-history" element={<ApprovalHistory />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
