import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  let response = NextResponse.next()

  // Create Supabase client for middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Define public routes that don't require authentication
  const publicRoutes = ['/login', '/forgot-password', '/reset-password']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  let isAuthenticated = false

  try {
    // Check if user is authenticated via Supabase
    const { data: { session } } = await supabase.auth.getSession()
    isAuthenticated = !!session?.user
  } catch (supabaseError) {
    // Supabase not available, checking fallback auth
  }

  // Also check legacy auth cookie for backward compatibility during transition
  if (!isAuthenticated) {
    const authToken = request.cookies.get('shoreagents-auth')?.value
    
    if (authToken) {
      try {
        let authData: any = null
        try {
          authData = JSON.parse(decodeURIComponent(authToken))
        } catch {
          authData = JSON.parse(authToken)
        }
        
        // If using fallback authentication or legacy auth, allow it during transition
        if (authData.isAuthenticated === true) {
          isAuthenticated = true
        }
      } catch (error) {
        // Clear invalid cookie
        response.cookies.delete('shoreagents-auth')
      }
    }
  }

  // Handle root path - redirect to dashboard if authenticated, login if not
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    } else {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // If user is not authenticated and trying to access protected route
  if (!isAuthenticated && !isPublicRoute) {
    // Avoid redirect loop on first request after stale session by allowing GET / to fall through to root handler
    if (pathname === '/') {
      return response
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If user is authenticated and trying to access login page
  if (isAuthenticated && (pathname === '/login' || pathname === '/login/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Allow the request to proceed
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
} 