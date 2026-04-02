import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL;

async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!BACKEND_URL) {
    return NextResponse.json({ error: "Proxy not configured" }, { status: 500 });
  }

  const { path } = await params;
  const targetPath = path.join("/");
  const url = new URL(req.url);
  const targetUrl = `${BACKEND_URL}/${targetPath}${url.search}`;

  const headers = new Headers(req.headers);
  // Remove host header so the backend gets the correct one
  headers.delete("host");

  const fetchOptions: RequestInit = {
    method: req.method,
    headers,
  };

  // Forward body for non-GET/HEAD requests
  if (req.method !== "GET" && req.method !== "HEAD") {
    fetchOptions.body = req.body;
    // @ts-expect-error duplex is needed for streaming body
    fetchOptions.duplex = "half";
  }

  const response = await fetch(targetUrl, fetchOptions);

  // Forward the response, including Set-Cookie headers
  const responseHeaders = new Headers(response.headers);
  // Remove transfer-encoding as Next.js handles this
  responseHeaders.delete("transfer-encoding");

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
