import { useEffect, useState } from 'react'
import { SafeAreaView, Text, View } from 'react-native'

import { SyncClient } from '../features/sync/sync-client.js'
import { UploadHandler } from '../features/sync/upload-handler.js'

const API_URL = 'http://localhost:3000'

const syncClient = new SyncClient()

const uploadHandler = new UploadHandler(syncClient, {
  apiBaseUrl: API_URL,
})

export default function App() {
  const [syncStatus, setSyncStatus] = useState<string>('disconnected')

  useEffect(() => {
    const initSync = async () => {
      try {
        await syncClient.connect({
          serverUrl: `${API_URL}/powersync`,
          syncToken: '',
        })
        setSyncStatus('connected')
      } catch {
        setSyncStatus('offline')
      }
    }

    initSync()

    const interval = setInterval(async () => {
      if (syncClient.status === 'connected') {
        await uploadHandler.drainQueue()
      }
    }, 30_000)

    return () => clearInterval(interval)
  }, [])

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Text style={{ fontSize: 12, color: syncStatus === 'connected' ? '#22c55e' : '#ef4444' }}>
          Sync: {syncStatus}
        </Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Offline-first POS: tables, cart, payments, shifts, and sync.</Text>
      </View>
    </SafeAreaView>
  )
}
