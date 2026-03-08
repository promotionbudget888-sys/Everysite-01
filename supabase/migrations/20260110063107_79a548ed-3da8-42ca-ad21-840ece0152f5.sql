-- Create profiles table for user management
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'requester' CHECK (role IN ('requester', 'zone_approver', 'admin')),
  zone_id UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create zones table for budget management
CREATE TABLE public.zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  total_budget DECIMAL(15,2) NOT NULL DEFAULT 0,
  used_budget DECIMAL(15,2) NOT NULL DEFAULT 0,
  remaining_budget DECIMAL(15,2) GENERATED ALWAYS AS (total_budget - used_budget) STORED,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key constraint for zone_id in profiles
ALTER TABLE public.profiles ADD CONSTRAINT profiles_zone_id_fkey FOREIGN KEY (zone_id) REFERENCES public.zones(id) ON DELETE SET NULL;

-- Create requests table for budget requests
CREATE TABLE public.requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(15,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_admin_review', 'pending_zone_approval', 'approved_by_zone', 'rejected_by_zone', 'returned', 'final_approved', 'final_rejected')),
  admin_notes TEXT,
  zone_approver_notes TEXT,
  final_notes TEXT,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create request_attachments table for uploaded documents
CREATE TABLE public.request_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit_logs table for tracking all actions
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  detail TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'approved')
);
CREATE POLICY "Zone approvers can view profiles in their zone" ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'zone_approver' AND status = 'approved')
);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'approved')
);

-- Zones policies
CREATE POLICY "All approved users can view zones" ON public.zones FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND status = 'approved')
);
CREATE POLICY "Admins can insert zones" ON public.zones FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'approved')
);
CREATE POLICY "Admins can update zones" ON public.zones FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'approved')
);
CREATE POLICY "Admins can delete zones" ON public.zones FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'approved')
);

-- Requests policies
CREATE POLICY "Requesters can view their own requests" ON public.requests FOR SELECT USING (
  requester_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can view all requests" ON public.requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'approved')
);
CREATE POLICY "Zone approvers can view requests in their zone" ON public.requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'zone_approver' AND status = 'approved' AND zone_id = requests.zone_id)
);
CREATE POLICY "Requesters can insert their own requests" ON public.requests FOR INSERT WITH CHECK (
  requester_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() AND status = 'approved')
);
CREATE POLICY "Requesters can update their own draft/returned requests" ON public.requests FOR UPDATE USING (
  requester_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) AND status IN ('draft', 'returned')
);
CREATE POLICY "Admins can update all requests" ON public.requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'approved')
);
CREATE POLICY "Zone approvers can update requests in their zone" ON public.requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'zone_approver' AND status = 'approved' AND zone_id = requests.zone_id)
);

-- Request attachments policies
CREATE POLICY "Users can view attachments of their requests" ON public.request_attachments FOR SELECT USING (
  request_id IN (SELECT id FROM public.requests WHERE requester_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
);
CREATE POLICY "Admins can view all attachments" ON public.request_attachments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'approved')
);
CREATE POLICY "Zone approvers can view attachments in their zone" ON public.request_attachments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.requests r 
    JOIN public.profiles p ON p.user_id = auth.uid() 
    WHERE r.id = request_attachments.request_id 
    AND p.role = 'zone_approver' 
    AND p.status = 'approved' 
    AND p.zone_id = r.zone_id
  )
);
CREATE POLICY "Requesters can insert attachments to their requests" ON public.request_attachments FOR INSERT WITH CHECK (
  request_id IN (SELECT id FROM public.requests WHERE requester_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
);
CREATE POLICY "Requesters can delete attachments from their draft requests" ON public.request_attachments FOR DELETE USING (
  request_id IN (SELECT id FROM public.requests WHERE requester_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) AND status IN ('draft', 'returned'))
);

-- Audit logs policies
CREATE POLICY "Admins can view all audit logs" ON public.audit_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin' AND status = 'approved')
);
CREATE POLICY "All approved users can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND status = 'approved')
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON public.zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON public.requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for request attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('request-attachments', 'request-attachments', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('approval-pdfs', 'approval-pdfs', false);

-- Storage policies for request-attachments bucket
CREATE POLICY "Users can upload attachments" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'request-attachments' AND auth.uid() IS NOT NULL
);
CREATE POLICY "Users can view their attachments" ON storage.objects FOR SELECT USING (
  bucket_id = 'request-attachments' AND auth.uid() IS NOT NULL
);
CREATE POLICY "Users can delete their attachments" ON storage.objects FOR DELETE USING (
  bucket_id = 'request-attachments' AND auth.uid() IS NOT NULL
);

-- Storage policies for approval-pdfs bucket
CREATE POLICY "Users can view their PDFs" ON storage.objects FOR SELECT USING (
  bucket_id = 'approval-pdfs' AND auth.uid() IS NOT NULL
);
CREATE POLICY "System can upload PDFs" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'approval-pdfs' AND auth.uid() IS NOT NULL
);