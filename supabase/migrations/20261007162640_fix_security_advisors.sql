-- Drop unused SECURITY DEFINER views (app uses get_inventory_dashboard RPC instead)
DROP VIEW IF EXISTS public.products_staff_view;
DROP VIEW IF EXISTS public.products_manager_view;

-- Fix mutable search_path on all functions
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.get_my_role() SET search_path = public;
ALTER FUNCTION public.is_manager() SET search_path = public;
ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.is_manager_or_admin() SET search_path = public;
ALTER FUNCTION public.get_inventory_dashboard() SET search_path = public;
ALTER FUNCTION public.change_stock(UUID, movement_type, INTEGER, UUID, TEXT, TEXT, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION public.prepare_stock_change(UUID, movement_type, INTEGER, UUID, TEXT, TEXT, TEXT) SET search_path = public;
ALTER FUNCTION public.confirm_stock_change(UUID, TEXT) SET search_path = public;
ALTER FUNCTION public.cancel_stock_change(UUID) SET search_path = public;
ALTER FUNCTION public.create_product(TEXT, TEXT, TEXT, UUID, UUID, NUMERIC, NUMERIC, INTEGER, INTEGER) SET search_path = public;
ALTER FUNCTION public.update_product_prices(UUID, NUMERIC, NUMERIC) SET search_path = public;
ALTER FUNCTION public.get_low_stock() SET search_path = public;
ALTER FUNCTION public.change_user_role(UUID, user_role) SET search_path = public;
ALTER FUNCTION public.set_user_active(UUID, BOOLEAN) SET search_path = public;
