import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedOwner = createRouteMatcher(["/owner/venues(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedOwner(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/owner/:path*"],
};
