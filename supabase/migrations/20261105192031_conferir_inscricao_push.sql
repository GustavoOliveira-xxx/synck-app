create function public.my_push_subscription_active(p_endpoint text)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.push_subscriptions where user_id=(select auth.uid()) and endpoint=p_endpoint);
$$;
revoke all on function public.my_push_subscription_active(text) from public,anon;
grant execute on function public.my_push_subscription_active(text) to authenticated;
