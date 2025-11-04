export interface Severity {
  id: string
  label: string
  weight: number
  description: string
}

export interface ErrorSubcategory {
  id: string
  label: string
  description: string
}

export interface ErrorCategory {
  id: string
  label: string
  description: string
  subcategories: ErrorSubcategory[]
}

export interface QualityModel {
  id: string
  name: string
  version: string
  description: string
  severities: Severity[]
  errorCategories: ErrorCategory[]
}
