import en from "@/locales/en.json"
import es from "@/locales/es.json"

export type Locale = "en" | "es"

const dictionaries = { en, es } as const

type NestedKeyOf<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? NestedKeyOf<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`
    }[keyof T & string]
  : never

export type TranslationKey = NestedKeyOf<typeof en>

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".")
  let current: unknown = obj
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return path
    }
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === "string" ? current : path
}

export function getTranslation(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const dict = dictionaries[locale]
  let value = getNestedValue(dict as unknown as Record<string, unknown>, key)

  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replace(`{${paramKey}}`, String(paramValue))
    }
  }

  return value
}
