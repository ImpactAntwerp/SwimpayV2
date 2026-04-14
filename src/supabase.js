import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = createClient(supabaseUrl, supabaseKey)

export async function dbGet(key) {
  try {
    const { data } = await supabase
      .from('app_data').select('value').eq('id', key).single()
    return data?.value ? JSON.parse(data.value) : null
  } catch { return null }
}

export async function dbSet(key, value) {
  try {
    await supabase.from('app_data').upsert({
      id: key,
      value: JSON.stringify(value),
      updated_at: new Date().toISOString()
    })
  } catch (e) { console.error('Save error:', e) }
}
