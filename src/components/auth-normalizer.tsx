"use client"

import { useEffect } from "react"
import { normalizeAuthOnEntry, refreshAuthDataFormat } from "@/lib/auth-utils"

export default function AuthNormalizer() {
  useEffect(() => {
    try {
      // Keep cookie and localStorage aligned to avoid double-login loops
      normalizeAuthOnEntry()
      // If hybrid auth format changed, update localStorage
      refreshAuthDataFormat()
    } catch {}
  }, [])

  return null
}


