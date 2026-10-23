import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/*
  Este archivo se ejecuta ANTES de cargar cualquier página.

  Su trabajo es simple: si alguien pide una página dentro de /admin
  (menos la de login) y no tiene una sesión válida, lo mandamos
  a /admin/login en vez de dejarlo pasar.
*/
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() (no getSession()) porque valida el token contra Supabase,
  // en vez de confiar en lo que diga la cookie sin más.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/admin/login";
  const isAdminRoute = pathname.startsWith("/admin");

  if (isAdminRoute && !isLoginPage && !user) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Si ya iniciaste sesión, no tiene sentido volver a ver el login
  if (isLoginPage && user) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return response;
}

// Solo se ejecuta para rutas dentro de /admin
export const config = {
  matcher: ["/admin/:path*"],
};
