import { ApiClient } from '@hospitality-os/api-client'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export const apiClient = new ApiClient(API_BASE)
