import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formats up to 10 digits as (XXX)-XXX-XXXX while typing; `prev` lets backspace remove through the punctuation. */
export function formatPhone(input: string, prev = ""): string {
  let digits = input.replace(/\D/g, "").slice(0, 10)
  if (input.length < prev.length && digits === prev.replace(/\D/g, "")) digits = digits.slice(0, -1)
  if (digits.length === 0) return ""
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)})-${digits.slice(3)}`
  return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6)}`
}
