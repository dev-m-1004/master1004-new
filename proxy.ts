import { NextRequest, NextResponse } from 'next/server'

function unauthorizedResponse() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Master1004 Admin"',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}

function decodeBasicAuth(encoded: string) {
  try {
    return atob(encoded)
  } catch {
    return ''
  }
}

export function proxy(request: NextRequest) {
  const validUser = process.env.ADMIN_BASIC_USER
  const validPassword = process.env.ADMIN_BASIC_PASSWORD

  if (!validUser || !validPassword) {
    return new NextResponse('Admin auth env is not configured', {
      status: 500,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  }

  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return unauthorizedResponse()
  }

  const base64Credentials = authHeader.slice('Basic '.length)
  const decoded = decodeBasicAuth(base64Credentials)
  const separatorIndex = decoded.indexOf(':')

  if (separatorIndex === -1) {
    return unauthorizedResponse()
  }

  const username = decoded.slice(0, separatorIndex)
  const password = decoded.slice(separatorIndex + 1)

  if (username !== validUser || password !== validPassword) {
    return unauthorizedResponse()
  }

  const response = NextResponse.next()
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
