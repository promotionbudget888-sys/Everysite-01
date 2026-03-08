-- Add sort_order column for proper numeric sorting
ALTER TABLE public.zones ADD COLUMN IF NOT EXISTS sort_order integer;

-- Update sort_order based on zone number
UPDATE public.zones SET sort_order = 1 WHERE name = 'โซน 1';
UPDATE public.zones SET sort_order = 2 WHERE name = 'โซน 2';
UPDATE public.zones SET sort_order = 3 WHERE name = 'โซน 3';
UPDATE public.zones SET sort_order = 4 WHERE name = 'โซน 4';
UPDATE public.zones SET sort_order = 5 WHERE name = 'โซน 5';
UPDATE public.zones SET sort_order = 6 WHERE name = 'โซน 6';
UPDATE public.zones SET sort_order = 7 WHERE name = 'โซน 7';
UPDATE public.zones SET sort_order = 8 WHERE name = 'โซน 8';
UPDATE public.zones SET sort_order = 9 WHERE name = 'โซน 9';
UPDATE public.zones SET sort_order = 10 WHERE name = 'โซน 10';
UPDATE public.zones SET sort_order = 11 WHERE name = 'โซน 11';
UPDATE public.zones SET sort_order = 12 WHERE name = 'โซน 12';
UPDATE public.zones SET sort_order = 13 WHERE name = 'โซน 13';
UPDATE public.zones SET sort_order = 14 WHERE name = 'โซน 14';
UPDATE public.zones SET sort_order = 15 WHERE name = 'โซน 15';
UPDATE public.zones SET sort_order = 16 WHERE name = 'โซน 16';