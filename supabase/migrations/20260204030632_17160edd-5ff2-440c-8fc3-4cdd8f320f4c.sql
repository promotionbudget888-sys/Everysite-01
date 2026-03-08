-- Add columns for request type, size, and size code
ALTER TABLE public.requests
ADD COLUMN request_type text,
ADD COLUMN size text,
ADD COLUMN size_code text;

-- Create sequence for size codes (starting from 1)
CREATE SEQUENCE IF NOT EXISTS public.size_code_seq START WITH 1 INCREMENT BY 1;

-- Create function to generate next size code (T00001, T00002, etc.)
CREATE OR REPLACE FUNCTION public.generate_size_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_val integer;
BEGIN
  next_val := nextval('size_code_seq');
  RETURN 'T' || LPAD(next_val::text, 5, '0');
END;
$$;

-- Add index for size_code for fast lookup
CREATE INDEX IF NOT EXISTS idx_requests_size_code ON public.requests(size_code);