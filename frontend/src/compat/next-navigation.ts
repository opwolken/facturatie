import { useLocation, useNavigate, useParams as useRouterParams } from "react-router-dom";

export function useRouter() {
  const navigate = useNavigate();

  return {
    push: (href: string) => navigate(href),
    replace: (href: string) => navigate(href, { replace: true }),
    back: () => navigate(-1),
    refresh: () => window.location.reload(),
  };
}

export function usePathname() {
  return useLocation().pathname;
}

export function useParams<T extends Record<string, string | undefined>>() {
  return useRouterParams() as T;
}